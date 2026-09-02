import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { isAbsolute, resolve } from 'node:path';

if (
  !process.env.DATABASE_URL ||
  !process.env.DOCUMENTS_STORAGE_ROOT ||
  !process.env.DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64
) {
  loadEnvFile(
    process.env.RUBI_API_ENV_FILE ?? new URL('../.env', import.meta.url),
  );
}

const require = createRequire(import.meta.url);
const {
  seedLocalDocumentsDemo,
} = require('../dist/documents/demo/local-document-demo.js');
const {
  parseLocalDocumentsDemoCli,
} = require('../dist/documents/demo/local-document-demo-cli.js');

const command = parseLocalDocumentsDemoCli(process.argv.slice(2), process.env);
const apiRoot = fileURLToPath(new URL('..', import.meta.url));
const configuredStorageRoot = process.env.DOCUMENTS_STORAGE_ROOT ?? '';
const storageRoot = isAbsolute(configuredStorageRoot)
  ? configuredStorageRoot
  : resolve(apiRoot, configuredStorageRoot);

const report = await seedLocalDocumentsDemo({
  databaseUrl: process.env.DATABASE_URL ?? '',
  environment: process.env.NODE_ENV ?? '',
  storageRoot,
  storageEncryptionKeyBase64:
    process.env.DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64 ?? '',
  antivirusMode: process.env.DOCUMENTS_ANTIVIRUS_MODE ?? '',
  antivirusCommand: process.env.DOCUMENTS_ANTIVIRUS_COMMAND,
  username:
    process.env.DOCUMENTS_DEMO_USERNAME ??
    process.env.IAM_BOOTSTRAP_ADMIN_USERNAME ??
    'nirvana',
  branchCode: process.env.DOCUMENTS_DEMO_BRANCH_CODE,
  apply: command.apply,
});

const byDomain = {};
for (const row of report.records)
  byDomain[row.domain] = (byDomain[row.domain] ?? 0) + 1;
console.log(
  JSON.stringify(
    {
      applied: report.applied,
      created: report.created,
      reused: report.reused,
      repairedFiles: report.repairedFiles,
      antivirusAvailable: report.antivirusAvailable,
      byDomain,
    },
    null,
    2,
  ),
);
