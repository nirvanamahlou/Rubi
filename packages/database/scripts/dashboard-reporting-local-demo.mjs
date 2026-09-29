import { Client } from 'pg';
import { config as loadEnvironment } from 'dotenv';
import { resolve } from 'node:path';

loadEnvironment({ path: resolve(process.cwd(), '../../.env'), quiet: true });
const PREFIX = 'LOCAL_DEMO_DASHBOARD_REPORTING_';
const serviceTypes = ['FLIGHT', 'HOTEL', 'TOUR', 'INSURANCE'];
const channels = [
  'وب‌سایت نیایش سیر',
  'وب‌سایت جهان‌باستان',
  'فروش کارشناسی',
  'API همکار',
];
const providers = ['ماهان', 'ایران‌ایر', 'ترکیش ایرلاینز', 'Booking Partner'];
const routes = [
  ['تهران', 'استانبول'],
  ['تهران', 'دبی'],
  ['تهران', 'مشهد'],
  ['تهران', 'کیش'],
  ['تهران', 'تفلیس'],
];
const customers = [
  'شرکت آریا سفر',
  'آژانس سپهرگرد',
  'گروه تجارت پارس',
  'خانم رضایی',
  'آقای احمدی',
];
const demoAgents = [
  'کارشناس دمو آریا',
  'کارشناس دمو پارسا',
  'کارشناس دمو سارا',
  'کارشناس دمو نیلوفر',
];
const amount = (index, base) =>
  String(base + ((index * 1_731_000) % (base * 2)));

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  if (
    process.argv.includes('--inspect') ||
    process.argv.includes('--verify-clean')
  ) {
    const result = await client.query(
      'SELECT "legalEntityCode", "currencyCode", COUNT(*)::int AS "factCount", COUNT(*) FILTER (WHERE "occurredAt" >= NOW() - INTERVAL \'31 days\')::int AS "monthFacts", SUM("salesAmount") FILTER (WHERE "occurredAt" >= NOW() - INTERVAL \'31 days\')::text AS "monthSales", MIN("occurredAt") AS "firstAt", MAX("occurredAt") AS "lastAt" FROM reporting_travel_facts WHERE "sourceItemId" LIKE $1 GROUP BY "legalEntityCode", "currencyCode" ORDER BY "legalEntityCode", "currencyCode"',
      [`${PREFIX}%`],
    );
    if (process.argv.includes('--verify-clean')) {
      const remaining = result.rows.reduce(
        (total, row) => total + Number(row.factCount),
        0,
      );
      if (remaining > 0)
        throw new Error(
          `${remaining} دادهٔ دمو هنوز در گزارش‌ها وجود دارد. پیش از Deploy، reporting:demo:clear را اجرا کنید.`,
        );
      console.log('No local dashboard/reporting demo facts remain.');
    } else console.log(JSON.stringify(result.rows));
  } else {
    await client.query('BEGIN');
    if (process.argv.includes('--clear')) {
      const result = await client.query(
        'DELETE FROM reporting_travel_facts WHERE "sourceItemId" LIKE $1',
        [`${PREFIX}%`],
      );
      await client.query('COMMIT');
      console.log(
        `Removed ${result.rowCount ?? 0} local dashboard/reporting demo facts.`,
      );
    } else {
      const branch = await client.query(
        'SELECT id,name FROM branches WHERE "isActive"=TRUE ORDER BY code LIMIT 1',
      );
      const owner = await client.query(
        'SELECT id,"displayName" FROM iam_users WHERE status=\'ACTIVE\' ORDER BY username LIMIT 1',
      );
      if (!branch.rows[0] || !owner.rows[0])
        throw new Error(
          'برای ساخت داده دمو حداقل یک شعبه و کاربر فعال لازم است.',
        );
      await client.query(
        'DELETE FROM reporting_travel_facts WHERE "sourceItemId" LIKE $1',
        [`${PREFIX}%`],
      );
      const now = Date.now();
      for (let index = 0; index < 180; index += 1) {
        const route = routes[index % routes.length];
        const demoAgent = demoAgents[index % demoAgents.length];
        const serviceType = serviceTypes[index % serviceTypes.length];
        const sales = amount(index, 8_000_000);
        const purchase = amount(index, 4_600_000);
        const refund = index % 17 === 0 ? amount(index, 310_000) : '0';
        const occurredAt = new Date(
          now - (index % 150) * 86_400_000,
        ).toISOString();
        const issueStatus = index % 8 === 0 ? 'PENDING' : 'ISSUED';
        const paymentStatus = index % 9 === 0 ? 'PENDING' : 'SETTLED';
        await client.query(
          `INSERT INTO reporting_travel_facts ("sourceItemId","sourceVersion","orderNumber","occurredAt","legalEntityCode","legalEntityName","branchId","branchName","ownerUserId","ownerName","siteCode","salesChannel","serviceType","customerType","customerName","agencyName","leadSource","providerName","airlineName","originCity","destinationCity","routeLabel","orderStatus","reservationStatus","issueStatus","paymentStatus","pnrCode","passengerCount","segmentCount","ticketCount","currencyCode","salesAmount","purchaseAmount","commissionAmount","refundAmount","settledAmount","dataAsOf","updatedAt") VALUES ($1,1,$2,$3,'NIYAYESH','شرکت نیایش سیر',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,NOW(),NOW())`,
          [
            `${PREFIX}${String(index + 1).padStart(3, '0')}`,
            `DMO-${new Date(occurredAt).getUTCFullYear()}-${String(index + 1).padStart(4, '0')}`,
            occurredAt,
            branch.rows[0].id,
            branch.rows[0].name,
            owner.rows[0].id,
            demoAgent,
            `SITE-${(index % 2) + 1}`,
            channels[index % channels.length],
            serviceType,
            index % 3 === 0
              ? 'AGENCY'
              : index % 3 === 1
                ? 'ORGANIZATION'
                : 'INDIVIDUAL',
            customers[index % customers.length],
            index % 3 === 0 ? customers[index % customers.length] : null,
            ['Google', 'تماس تلفنی', 'معرفی آژانس'][index % 3],
            providers[index % providers.length],
            providers[index % 3],
            route[0],
            route[1],
            `${route[0]} ← ${route[1]}`,
            index % 19 === 0 ? 'CANCELLED' : 'CONFIRMED',
            index % 13 === 0
              ? 'CANCELLED'
              : index % 7 === 0
                ? 'PENDING'
                : 'CONFIRMED',
            issueStatus,
            paymentStatus,
            `PNR${String(index + 1000)}`,
            (index % 5) + 1,
            (index % 3) + 1,
            issueStatus === 'ISSUED' ? (index % 5) + 1 : 0,
            index % 11 === 0 ? 'USD' : 'IRR',
            sales,
            purchase,
            amount(index, 180_000),
            refund,
            paymentStatus === 'SETTLED' ? sales : '0',
          ],
        );
      }
      await client.query('COMMIT');
      console.log(
        'Generated 180 synthetic local dashboard/reporting demo facts, including trend, action-queue, decision-funnel and team-comparison coverage. Run reporting:demo:clear then reporting:demo:verify-clean before deployment.',
      );
    }
  }
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  await client.end();
}
