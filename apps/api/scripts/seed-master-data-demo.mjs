import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';

if (!process.env.DATABASE_URL)
  loadEnvFile(
    process.env.RUBI_API_ENV_FILE ?? new URL('../.env', import.meta.url),
  );

const require = createRequire(import.meta.url);
const {
  seedLocalMasterDataDemo,
} = require('../dist/master-data/demo/local-demo.js');
const {
  parseLocalDemoCli,
} = require('../dist/master-data/demo/local-demo-cli.js');

const command = parseLocalDemoCli(process.argv.slice(2), process.env);

const report = await seedLocalMasterDataDemo({
  databaseUrl: process.env.DATABASE_URL ?? '',
  environment: process.env.NODE_ENV ?? '',
  contactKey: process.env.MASTER_DATA_IMPORT_TOKEN_KEY_BASE64 ?? '',
  apply: command.apply,
  realistic: command.realistic,
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
