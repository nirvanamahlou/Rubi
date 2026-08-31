import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const {
  seedLocalMasterDataDemo,
} = require('../dist/master-data/demo/local-demo.js');

const mode = process.argv[2];
if (
  ![
    '--preview',
    '--apply',
    '--preview-realistic',
    '--apply-realistic',
  ].includes(mode) ||
  process.argv.length !== 3
)
  throw new Error(
    'Specify --preview/--apply or --preview-realistic/--apply-realistic. Build the API first.',
  );
if (
  mode.startsWith('--apply') &&
  process.env.RUBI_ALLOW_LOCAL_MASTER_DEMO !== '1'
)
  throw new Error(
    'Set RUBI_ALLOW_LOCAL_MASTER_DEMO=1 to acknowledge local synthetic data creation.',
  );

const report = await seedLocalMasterDataDemo({
  databaseUrl: process.env.DATABASE_URL ?? '',
  environment: process.env.NODE_ENV ?? '',
  contactKey: process.env.MASTER_DATA_IMPORT_TOKEN_KEY_BASE64 ?? '',
  apply: mode.startsWith('--apply'),
  realistic: mode.endsWith('-realistic'),
});
const byResource = {};
for (const row of report.records)
  byResource[row.resource] = (byResource[row.resource] ?? 0) + 1;
console.log(
  JSON.stringify(
    {
      applied: report.applied,
      created: report.created,
      reused: report.reused,
      refreshed: report.refreshed,
      byResource,
    },
    null,
    2,
  ),
);
