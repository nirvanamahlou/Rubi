import {
  createDatabaseClient,
  Prisma,
  type DatabaseClient,
} from '@nora/database';
import { nativeSalesReport } from '../../apps/api/src/reporting/reporting-native-sales';
import { nativePaymentReport } from '../../apps/api/src/reporting/reporting-native-payments';
import { ReportingExportService } from '../../apps/api/src/reporting/reporting-export.service';
import { REPORTING_CATALOG_V1 } from '../../apps/api/src/reporting/reporting.catalog';
import type { LocalDocumentStorage } from '../../apps/api/src/documents/documents.storage';

async function main() {
  const db = createDatabaseClient();
  try {
    const output = await db.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await tx.$executeRawUnsafe("SET LOCAL statement_timeout = '30s'");
        const actor = {
          userId: 'system:read-only-reconciliation',
          branchIds: [],
          permissions: ['sales.contracts.read.all', 'sales.payments.read'],
        };
        const query = {
          filters: {},
          page: 1,
          pageSize: 100,
          timezone: 'Asia/Tehran' as const,
        };
        const reference = await tx.$queryRaw<
          { currencyCode: string; amount: string }[]
        >(Prisma.sql`
        SELECT p.currency_code AS "currencyCode",SUM(CASE WHEN p.type='DISCOUNT' THEN -p.amount ELSE p.amount END)::text AS amount
        FROM sales_contract_price_components p JOIN sales_contracts c ON c.id=p.contract_id
        WHERE c.confirmed_at IS NOT NULL AND c.status IN ('CONFIRMED','SENT_TO_RESERVATIONS','IN_PROGRESS','COMPLETED')
        GROUP BY p.currency_code ORDER BY p.currency_code`);
        const sourceStats = await tx.$queryRaw(Prisma.sql`
        SELECT c.status::text,COUNT(*)::text AS contracts,
        COUNT(*) FILTER(WHERE NOT EXISTS(SELECT 1 FROM sales_contract_price_components p WHERE p.contract_id=c.id))::text AS unpriced
        FROM sales_contracts c GROUP BY c.status ORDER BY c.status`);
        const files: { name: string; base64: string }[] = [];
        const reports: Record<string, unknown>[] = [];
        const exporter = new ReportingExportService({} as LocalDocumentStorage);
        for (const code of [
          'sales_by_organization',
          'sales_by_service_route',
          'route_passengers',
          'sales_contract_pipeline',
          'payments_refunds',
        ]) {
          try {
            const result =
              code === 'payments_refunds'
                ? await nativePaymentReport(
                    tx as unknown as DatabaseClient,
                    query,
                    actor,
                    true,
                  )
                : await nativeSalesReport(
                    tx as unknown as DatabaseClient,
                    code,
                    query,
                    actor,
                    true,
                  );
            const matches = [
              'sales_by_organization',
              'sales_by_service_route',
              'route_passengers',
            ].includes(code)
              ? reference.every((expected) =>
                  new Prisma.Decimal(
                    result.totalsByCurrency.find(
                      (row) => row.currencyCode === expected.currencyCode,
                    )?.salesAmount ?? 0,
                  ).equals(expected.amount),
                ) && result.totalsByCurrency.length === reference.length
              : null;
            if (matches === false) throw new Error('REFERENCE_TOTAL_MISMATCH');
            const built = exporter.build(
              'XLSX',
              result,
              REPORTING_CATALOG_V1.find((report) => report.code === code)
                ?.title ?? code,
            );
            files.push({
              name: code + '.xlsx',
              base64: built.buffer.toString('base64'),
            });
            reports.push({
              code,
              state: 'verified',
              rows: result.total,
              source: result.sourceProjection,
              referenceMatches: matches,
              totals: result.totalsByCurrency.map((row) => ({
                currencyCode: row.currencyCode,
                salesAmount: row.salesAmount,
                refundAmount: row.refundAmount,
              })),
            });
          } catch (error) {
            reports.push({
              code,
              state: 'unavailable',
              reason:
                error instanceof Error
                  ? error.message.slice(0, 240)
                  : 'SOURCE_UNAVAILABLE',
            });
          }
        }
        return {
          databaseWrites: false,
          applicationChanges: false,
          privilegedReadOnlyAudit: true,
          authenticatedUserAcceptance: false,
          generatedAtUtc: new Date().toISOString(),
          sourceStats,
          reference,
          reports,
          files,
        };
      },
      { isolationLevel: 'RepeatableRead', timeout: 120000, maxWait: 10000 },
    );
    process.stdout.write(JSON.stringify(output));
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  process.stderr.write('Read-only report reconciliation failed.\n');
  process.exitCode = 1;
});
