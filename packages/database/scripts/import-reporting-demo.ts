import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Client } from 'pg';
import { config as loadEnvironment } from 'dotenv';

loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });

interface DemoFact {
  sourceItemId: string;
  orderNumber: string;
  occurredAt: string;
  legalEntityCode: string;
  legalEntityName: string;
  branchCode: string;
  ownerUsername: string;
  siteCode: string;
  salesChannel: string;
  serviceType: string;
  customerType: string;
  customerName: string;
  agencyName?: string;
  leadSource?: string;
  providerName?: string;
  airlineName?: string;
  originCity?: string;
  destinationCity?: string;
  routeLabel?: string;
  orderStatus: string;
  reservationStatus: string;
  issueStatus: string;
  paymentStatus: string;
  pnrCode?: string;
  passengerCount: number;
  segmentCount: number;
  ticketCount: number;
  currencyCode: string;
  salesAmount: string;
  purchaseAmount: string;
  commissionAmount: string;
  refundAmount: string;
  settledAmount: string;
}

interface Fixture {
  facts: DemoFact[];
  workspace?: {
    actorUsername: string;
    savedReports?: {
      id: string;
      reportCode: string;
      name: string;
      sharingScope: 'PERSONAL' | 'TEAM';
      isFavorite: boolean;
      filterState: Record<string, unknown>;
    }[];
    runs?: {
      id: string;
      reportCode: string;
      savedReportId?: string;
      status: 'SUCCEEDED' | 'FAILED';
      filterSnapshot: Record<string, unknown>;
      recordCount?: number;
      durationMs?: number;
      errorMessage?: string;
    }[];
    schedules?: {
      id: string;
      savedReportId: string;
      name: string;
      frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
      runAtLocalTime: string;
      recipients: string[];
      format: 'CSV' | 'XLSX' | 'PDF';
      status: 'ACTIVE' | 'PAUSED';
    }[];
    exports?: {
      id: string;
      runId: string;
      reportCode: string;
      reportName: string;
      format: 'CSV' | 'XLSX' | 'PDF';
      status: 'FAILED' | 'EXPIRED';
      fileName: string;
      contentType: string;
      filterSnapshot: Record<string, unknown>;
      errorMessage?: string;
    }[];
  };
}

const REPORTING_DEMO_PERMISSIONS = [
  ['reporting.read', 'مشاهده کاتالوگ و داده‌های گزارش'],
  ['reporting.sales.read', 'مشاهده گزارش‌های فروش و سفر'],
  ['reporting.procurement.read', 'مشاهده گزارش‌های خرید و تأمین'],
  ['reporting.finance.read', 'مشاهده گزارش‌های مالی'],
  ['reporting.reservations.read', 'مشاهده گزارش‌های رزرواسیون و صدور'],
  ['reporting.tickets.read', 'مشاهده گزارش‌های بلیت و مانیفست'],
  ['reporting.b2b.read', 'مشاهده گزارش‌های آژانس و مشتری سازمانی'],
  ['reporting.export', 'ایجاد و دانلود خروجی گزارش'],
  ['reporting.share', 'اشتراک‌گذاری گزارش ذخیره‌شده با کاربران مجاز'],
  ['reporting.manage', 'مدیریت گزارش‌های ذخیره‌شده تیمی'],
  ['reporting.audit.read', 'مشاهده سابقه اجرا و خروجی گزارش'],
] as const;

async function main() {
  const cliFixture = process.argv.slice(2).find((value) => value !== '--');
  const fixturePath = process.env.REPORTING_DEMO_FIXTURE
    ? resolve(process.cwd(), process.env.REPORTING_DEMO_FIXTURE)
    : cliFixture
      ? resolve(process.cwd(), '../..', cliFixture)
      : resolve(process.cwd(), '../../tmp/reporting-demo.json');
  const payload = JSON.parse(await readFile(fixturePath, 'utf8')) as Fixture;
  if (!Array.isArray(payload.facts) || payload.facts.length < 20)
    throw new Error(
      'Local ignored fixture must contain at least 20 reporting facts.',
    );
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    for (const fact of payload.facts) {
      const branch = await client.query<{ id: string; name: string }>(
        'SELECT id,name FROM branches WHERE code=$1 LIMIT 1',
        [fact.branchCode],
      );
      const owner = await client.query<{ id: string; displayName: string }>(
        'SELECT id,"displayName" FROM iam_users WHERE lower(username)=lower($1) LIMIT 1',
        [fact.ownerUsername],
      );
      const values = [
        fact.sourceItemId,
        fact.orderNumber,
        fact.occurredAt,
        fact.legalEntityCode,
        fact.legalEntityName,
        branch.rows[0]?.id ?? null,
        branch.rows[0]?.name ?? fact.branchCode,
        owner.rows[0]?.id ?? null,
        owner.rows[0]?.displayName ?? fact.ownerUsername,
        fact.siteCode,
        fact.salesChannel,
        fact.serviceType,
        fact.customerType,
        fact.customerName,
        fact.agencyName ?? null,
        fact.leadSource ?? null,
        fact.providerName ?? null,
        fact.airlineName ?? null,
        fact.originCity ?? null,
        fact.destinationCity ?? null,
        fact.routeLabel ?? null,
        fact.orderStatus,
        fact.reservationStatus,
        fact.issueStatus,
        fact.paymentStatus,
        fact.pnrCode ?? null,
        fact.passengerCount,
        fact.segmentCount,
        fact.ticketCount,
        fact.currencyCode,
        fact.salesAmount,
        fact.purchaseAmount,
        fact.commissionAmount,
        fact.refundAmount,
        fact.settledAmount,
      ];
      await client.query(
        `INSERT INTO reporting_travel_facts ("sourceItemId","sourceVersion","orderNumber","occurredAt","legalEntityCode","legalEntityName","branchId","branchName","ownerUserId","ownerName","siteCode","salesChannel","serviceType","customerType","customerName","agencyName","leadSource","providerName","airlineName","originCity","destinationCity","routeLabel","orderStatus","reservationStatus","issueStatus","paymentStatus","pnrCode","passengerCount","segmentCount","ticketCount","currencyCode","salesAmount","purchaseAmount","commissionAmount","refundAmount","settledAmount","dataAsOf","updatedAt") VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,NOW(),NOW()) ON CONFLICT ("sourceItemId","currencyCode") DO UPDATE SET "sourceVersion"=EXCLUDED."sourceVersion","orderNumber"=EXCLUDED."orderNumber","occurredAt"=EXCLUDED."occurredAt","legalEntityCode"=EXCLUDED."legalEntityCode","legalEntityName"=EXCLUDED."legalEntityName","branchId"=EXCLUDED."branchId","branchName"=EXCLUDED."branchName","ownerUserId"=EXCLUDED."ownerUserId","ownerName"=EXCLUDED."ownerName","siteCode"=EXCLUDED."siteCode","salesChannel"=EXCLUDED."salesChannel","serviceType"=EXCLUDED."serviceType","customerType"=EXCLUDED."customerType","customerName"=EXCLUDED."customerName","agencyName"=EXCLUDED."agencyName","leadSource"=EXCLUDED."leadSource","providerName"=EXCLUDED."providerName","airlineName"=EXCLUDED."airlineName","originCity"=EXCLUDED."originCity","destinationCity"=EXCLUDED."destinationCity","routeLabel"=EXCLUDED."routeLabel","orderStatus"=EXCLUDED."orderStatus","reservationStatus"=EXCLUDED."reservationStatus","issueStatus"=EXCLUDED."issueStatus","paymentStatus"=EXCLUDED."paymentStatus","pnrCode"=EXCLUDED."pnrCode","passengerCount"=EXCLUDED."passengerCount","segmentCount"=EXCLUDED."segmentCount","ticketCount"=EXCLUDED."ticketCount","salesAmount"=EXCLUDED."salesAmount","purchaseAmount"=EXCLUDED."purchaseAmount","commissionAmount"=EXCLUDED."commissionAmount","refundAmount"=EXCLUDED."refundAmount","settledAmount"=EXCLUDED."settledAmount","dataAsOf"=NOW(),"updatedAt"=NOW()`,
        values,
      );
    }
    if (payload.workspace) {
      const actor = await client.query<{ id: string }>(
        'SELECT id FROM iam_users WHERE lower(username)=lower($1) LIMIT 1',
        [payload.workspace.actorUsername],
      );
      if (!actor.rows[0])
        throw new Error('Workspace actor from local fixture was not found.');
      const actorId = actor.rows[0].id;
      for (const [code, name] of REPORTING_DEMO_PERMISSIONS) {
        const permission = await client.query<{ id: string }>(
          "INSERT INTO iam_permissions (id,code,module,name) VALUES (gen_random_uuid(),$1,'reporting',$2) ON CONFLICT (code) DO UPDATE SET module=EXCLUDED.module,name=EXCLUDED.name RETURNING id",
          [code, name],
        );
        await client.query(
          'INSERT INTO iam_role_permissions ("roleId","permissionId") SELECT ur."roleId",$2 FROM iam_user_roles ur WHERE ur."userId"=$1 ON CONFLICT ("roleId","permissionId") DO NOTHING',
          [actorId, permission.rows[0]!.id],
        );
      }
      for (const item of payload.workspace.savedReports ?? [])
        await client.query(
          'INSERT INTO reporting_saved_reports (id,"reportCode",name,"ownerUserId","sharingScope","isFavorite","filterState","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,"ownerUserId"=EXCLUDED."ownerUserId","sharingScope"=EXCLUDED."sharingScope","isFavorite"=EXCLUDED."isFavorite","filterState"=EXCLUDED."filterState","updatedAt"=NOW()',
          [
            item.id,
            item.reportCode,
            item.name,
            actorId,
            item.sharingScope,
            item.isFavorite,
            JSON.stringify(item.filterState),
          ],
        );
      for (const item of payload.workspace.runs ?? [])
        await client.query(
          'INSERT INTO reporting_runs (id,"reportCode","savedReportId","actorUserId",status,"filterSnapshot","viewName","viewVersion","recordCount","durationMs","errorMessage","startedAt","finishedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$9,$10,NOW(),NOW()) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,"recordCount"=EXCLUDED."recordCount","durationMs"=EXCLUDED."durationMs","errorMessage"=EXCLUDED."errorMessage"',
          [
            item.id,
            item.reportCode,
            item.savedReportId ?? null,
            actorId,
            item.status,
            JSON.stringify(item.filterSnapshot),
            'reporting.travel.facts.v1',
            item.recordCount ?? null,
            item.durationMs ?? null,
            item.errorMessage ?? null,
          ],
        );
      for (const item of payload.workspace.schedules ?? [])
        await client.query(
          'INSERT INTO reporting_schedules (id,"savedReportId","ownerUserId",name,frequency,"runAtLocalTime",recipients,format,status,"nextRunAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW()+INTERVAL \'1 day\',NOW()) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,"nextRunAt"=EXCLUDED."nextRunAt","updatedAt"=NOW()',
          [
            item.id,
            item.savedReportId,
            actorId,
            item.name,
            item.frequency,
            item.runAtLocalTime,
            JSON.stringify(item.recipients),
            item.format,
            item.status,
          ],
        );
      for (const item of payload.workspace.exports ?? [])
        await client.query(
          'INSERT INTO reporting_export_artifacts (id,"runId","creatorUserId","reportCode","reportName",format,status,"fileName","contentType","filterSnapshot","errorMessage","expiresAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6::"ReportingExportFormat",$7::"ReportingExportStatus",$8,$9,$10,$11,CASE WHEN $7::text=\'EXPIRED\' THEN NOW()-INTERVAL \'1 day\' ELSE NULL END,NOW()) ON CONFLICT (id) DO UPDATE SET status=EXCLUDED.status,"errorMessage"=EXCLUDED."errorMessage","updatedAt"=NOW()',
          [
            item.id,
            item.runId,
            actorId,
            item.reportCode,
            item.reportName,
            item.format,
            item.status,
            item.fileName,
            item.contentType,
            JSON.stringify(item.filterSnapshot),
            item.errorMessage ?? null,
          ],
        );
    }
    await client.query('COMMIT');
    console.log(
      `Imported ${payload.facts.length} reporting facts from local ignored fixture.`,
    );
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

void main();
