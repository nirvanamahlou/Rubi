// Local-only, additive fixture loader. All writes use Master Data's service.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { ConfigService } = require('@nestjs/config');
const { createDatabaseClient } = require('@rubi/database');
const {
  MasterDataRepository,
} = require('../dist/master-data/master-data.repository.js');
const {
  MasterDataService,
} = require('../dist/master-data/master-data.service.js');
const {
  MasterDataContactCrypto,
} = require('../dist/master-data/master-data-contact.crypto.js');
const [mode, databaseName] = process.argv.slice(2);
if (
  !['--preview', '--apply'].includes(mode) ||
  !/^rubi_hr_current_\d{8}$/.test(databaseName ?? '') ||
  process.argv.length !== 4
)
  throw new Error(
    'Specify --preview or --apply and the confirmed local runtime database.',
  );
const url = new URL(process.env.DATABASE_URL ?? '');
if (
  !['postgres:', 'postgresql:'].includes(url.protocol) ||
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.port !== '55432' ||
  [...url.searchParams].some(
    ([key, value]) => key !== 'schema' || value !== 'public',
  ) ||
  url.hash ||
  process.env.NODE_ENV === 'production'
)
  throw new Error(
    'Only the verified local development PostgreSQL target is permitted.',
  );
url.pathname = `/${databaseName}`;
const records = [
  ['B2B-DEMO-001', 'آژانس آزمایشی افق سفر', 'AGENCY'],
  ['B2B-DEMO-002', 'آژانس آزمایشی آبیراه', 'AGENCY'],
  ['B2B-DEMO-003', 'آژانس آزمایشی آسمان', 'AGENCY'],
  ['B2B-DEMO-004', 'آژانس آزمایشی نیلگون', 'AGENCY'],
  ['B2B-DEMO-005', 'شرکت آزمایشی توسعه سفر', 'CORPORATE_CUSTOMER'],
  ['B2B-DEMO-006', 'گروه آزمایشی سپهر', 'CORPORATE_CUSTOMER'],
  ['B2B-DEMO-007', 'مؤسسه آزمایشی پارس', 'CORPORATE_CUSTOMER'],
  ['B2B-DEMO-008', 'سازمان آزمایشی چندنقشی', 'AGENCY,CORPORATE_CUSTOMER'],
];
// Offline audit attribution only; no IAM identity, session or permission is created.
const actor = {
  userId: 'f0000000-0000-4000-8000-000000000001',
  sessionId: 'f0000000-0000-4000-8000-000000000002',
  branchIds: ['f0000000-0000-4000-8000-000000000003'],
  permissions: ['master_data.read', 'master_data.create'],
};
const client = createDatabaseClient(url.toString());
try {
  const service = new MasterDataService(
    new MasterDataRepository({ client }),
    new MasterDataContactCrypto(new ConfigService(process.env)),
  );
  const pending = [];
  const storedCodes = [];
  let reused = 0;
  for (const [code, legalName, roleCodes] of records) {
    const response = await service.list('organizations', {
      search: legalName,
      status: 'all',
      sortBy: 'code',
      sortDirection: 'asc',
      page: 1,
      pageSize: 100,
    });
    const existing = response.data.find((record) => record.name === legalName);
    if (existing) {
      if (
        existing.name !== legalName ||
        String(existing.attributes.roleCodes) !== roleCodes
      )
        throw new Error(
          `Fixture collision at ${code}; existing records were not modified.`,
        );
      reused++;
      storedCodes.push(existing.code);
    } else pending.push({ legalName, roleCodes, personType: 'LEGAL' });
  }
  let created = 0;
  if (mode === '--apply')
    for (const values of pending) {
      const result = await service.create('organizations', values, actor);
      storedCodes.push(result.data.code);
      created++;
    }
  console.log(
    JSON.stringify(
      {
        database: databaseName,
        mode,
        created,
        reused,
        pending: mode === '--preview' ? pending.length : 0,
        codes: storedCodes,
      },
      null,
      2,
    ),
  );
} finally {
  await client.$disconnect();
}
