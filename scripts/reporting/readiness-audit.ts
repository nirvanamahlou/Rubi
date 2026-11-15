/** Explicit read-only candidate verification; does not start the app or publish an image. */
import {
  createDatabaseClient,
  Prisma,
  type DatabaseClient,
} from '@nora/database';
import { strFromU8, unzipSync } from 'fflate';
import {
  nativeOperationalReport,
  OPERATIONAL_REPORTS,
} from '../../apps/api/src/reporting/reporting-native-operational';
import {
  nativeSalesReport,
  NATIVE_SALES_REPORTS,
} from '../../apps/api/src/reporting/reporting-native-sales';
import { readSalesReportingEligibility } from '../../apps/api/src/sales/sales-reporting-eligibility.public';
import { nativePaymentReport } from '../../apps/api/src/reporting/reporting-native-payments';
import { ReportingExportService } from '../../apps/api/src/reporting/reporting-export.service';
import type { LocalDocumentStorage } from '../../apps/api/src/documents/documents.storage';

async function main() {
  const db = createDatabaseClient();
  try {
    const receipt = await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout='20s'");
        const branches = await tx.$queryRaw<{ id: string }[]>(
          Prisma.sql`SELECT id FROM branches WHERE "isActive"=true`,
        );
        // An isolated system probe, not a browser login or impersonated user. Own audit stays empty.
        const actor = {
          userId: '00000000-0000-4000-8000-000000000000',
          branchIds: branches.map((b) => b.id),
          permissions: [
            'sales.contracts.read.all',
            'sales.payments.read',
            'reservations.read',
            'ticket_catalog.read',
            'customers.read',
            'hr.read',
            'documents.list',
            'customer_affairs.ticket.read',
            'documents.sales.read',
            'documents.reservations.read',
            'reporting.audit.read',
          ],
        };
        const query = {
          filters: {},
          page: 1,
          pageSize: 100,
          timezone: 'Asia/Tehran' as const,
        };
        const client = tx as unknown as DatabaseClient;
        // Share only the public eligibility cohort. Purchase versions, coverage
        // and Decimal sums below remain an independently computed reference.
        const eligible = await readSalesReportingEligibility(client, actor);
        const exporter = new ReportingExportService({} as LocalDocumentStorage);
        const purchaseReference = await tx.$queryRaw<
          { currencyCode: string; amount: string }[]
        >(Prisma.sql`
        WITH p AS (
          SELECT p.id,p.version,p.amount,p."currencyCode",i."contractId",i."contractVersion",
            CASE WHEN jsonb_typeof(p."coveredServiceClientKeys")='array' AND jsonb_array_length(p."coveredServiceClientKeys")>0
              THEN p."coveredServiceClientKeys" ELSE jsonb_build_array(p."serviceClientKey") END AS keys
          FROM "ReservationServicePurchase" p JOIN "ReservationIntake" i ON i.id=p."intakeId"
          JOIN sales_contracts c ON c.id=i."contractId"
          WHERE c.confirmed_at IS NOT NULL AND c.status IN ('CONFIRMED','SENT_TO_RESERVATIONS','IN_PROGRESS','COMPLETED')
            AND c.id IN (${eligible.length ? Prisma.join(eligible.map((id) => Prisma.sql`${id}::uuid`)) : Prisma.sql`NULL::uuid`})
            AND i."branchId" IN (${Prisma.join(actor.branchIds.map((id) => Prisma.sql`${id}::uuid`))})
        ) SELECT p."currencyCode",SUM(p.amount)::text AS amount FROM p
        WHERE NOT EXISTS(SELECT 1 FROM p n WHERE n."contractId"=p."contractId"
          AND (n."contractVersion">p."contractVersion" OR (n."contractVersion"=p."contractVersion" AND n.version>p.version))
          AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(p.keys) AS k(key) WHERE n.keys ? k.key))
        GROUP BY p."currencyCode" ORDER BY p."currencyCode"
      `);
        const reports: Record<string, unknown>[] = [];
        for (const code of [
          ...NATIVE_SALES_REPORTS,
          'payments_refunds',
          ...Object.keys(OPERATIONAL_REPORTS),
        ]) {
          await tx.$executeRawUnsafe('SAVEPOINT report_read');
          try {
            const result = Object.hasOwn(OPERATIONAL_REPORTS, code)
              ? await nativeOperationalReport(client, code, query, actor, true)
              : code === 'payments_refunds'
                ? await nativePaymentReport(client, query, actor, true)
                : await nativeSalesReport(client, code, query, actor, true);
            const zip = unzipSync(
              new Uint8Array(
                exporter.build('XLSX', result, 'بررسی فقط‌خواندنی').buffer,
              ),
            );
            const sheet = strFromU8(zip['xl/worksheets/sheet1.xml']!);
            const table = strFromU8(zip['xl/tables/table1.xml']!);
            const columnParity = result.columns.every((column) =>
              table.includes(column.label.replaceAll('&', '&amp;')),
            );
            let referenceMatches: boolean | null = null;
            if (code === 'purchase_by_supplier') {
              const totals = new Map<string, Prisma.Decimal>();
              for (const r of result.rows) {
                // Consolidated rows expose exact monetary values separately
                // from the formatted multi-currency table label.
                for (const amount of r.amountsByCurrency ?? [
                  {
                    currencyCode: String(r.sourceValues?.currencyCode ?? ''),
                    amount: String(r.sourceValues?.registeredAmount ?? '0'),
                  },
                ]) {
                  totals.set(
                    amount.currencyCode,
                    (
                      totals.get(amount.currencyCode) ?? new Prisma.Decimal(0)
                    ).add(amount.amount),
                  );
                }
              }
              referenceMatches =
                totals.size === purchaseReference.length &&
                purchaseReference.every((r) =>
                  totals.get(r.currencyCode)?.equals(r.amount),
                );
              if (!referenceMatches)
                throw Error('PURCHASE_RECONCILIATION_FAILED');
            }
            if (!columnParity || !sheet.includes('showGridLines="0"'))
              throw Error('EXPORT_LAYOUT_MISMATCH');
            reports.push({
              code,
              state: 'verified',
              rows: result.total,
              projection: result.sourceProjection,
              columns: result.columns.length,
              xlsxGenerated: true,
              columnParity,
              referenceMatches,
            });
            await tx.$executeRawUnsafe('RELEASE SAVEPOINT report_read');
          } catch (error) {
            await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT report_read');
            await tx.$executeRawUnsafe('RELEASE SAVEPOINT report_read');
            reports.push({
              code,
              state: 'blocked',
              error: error instanceof Error ? error.name : 'UnknownError',
            });
          }
        }
        // Independent reference counts, never record contents or amounts.
        const reference = await tx.$queryRaw(Prisma.sql`
        SELECT 'customers' AS source,COUNT(*)::int AS rows FROM customers WHERE "isCustomer" AND "mergedIntoId" IS NULL
        UNION ALL SELECT 'confirmed-contracts',COUNT(*)::int FROM sales_contracts WHERE confirmed_at IS NOT NULL AND status IN ('CONFIRMED','SENT_TO_RESERVATIONS','IN_PROGRESS','COMPLETED')
        UNION ALL SELECT 'cancelled-contracts',COUNT(*)::int FROM sales_contracts WHERE status='CANCELLED'
        UNION ALL SELECT 'issued-documents',COUNT(*)::int FROM reservation_ticket_documents
        UNION ALL SELECT 'confirmed-payments',COUNT(*)::int FROM sales_contract_payment_entries WHERE status='FINANCE_CONFIRMED'
        UNION ALL SELECT 'ticket-offers',COUNT(*)::int FROM "TicketPublishedOffer"
      `);
        return {
          generatedAt: new Date().toISOString(),
          databaseWrites: false,
          applicationDeployment: false,
          browserAcceptance: false,
          reports,
          reference,
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 180000 },
    );
    process.stdout.write(JSON.stringify(receipt));
  } finally {
    await db.$disconnect();
  }
}
void main().catch(() => {
  process.stderr.write('Read-only candidate verification failed');
  process.exitCode = 1;
});
