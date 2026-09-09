import { stat } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { loadEnvFile } from 'node:process';
import {
  assertLocalDatabase,
  createMissingCompanies,
  inspectCompanies,
} from './local-legal-entities-lib.mjs';

let database;
try {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const value = (flag) =>
    args.find((arg) => arg.startsWith(`${flag}=`))?.slice(flag.length + 1);
  if (
    args.some(
      (arg) =>
        arg !== '--apply' &&
        arg !== '--check' &&
        !arg.startsWith('--actor-id=') &&
        !arg.startsWith('--backup='),
    )
  )
    throw new Error('Use --check or --apply --actor-id=UUID --backup=PATH.');
  if (apply && args.includes('--check'))
    throw new Error('Choose either --check or --apply.');
  if (!process.env.DATABASE_URL)
    loadEnvFile(
      process.env.RUBI_API_ENV_FILE ?? new URL('../.env', import.meta.url),
    );
  assertLocalDatabase(process.env.DATABASE_URL ?? '', process.env.NODE_ENV);
  if (apply) {
    const backup = value('--backup');
    if (!backup)
      throw new Error(
        'Create a database backup and pass --backup=PATH before applying.',
      );
    const details = await stat(backup);
    if (!details.isFile() || details.size === 0)
      throw new Error('The backup must be a non-empty file.');
  }
  const require = createRequire(import.meta.url);
  const { LEGAL_ENTITY_CODES } = require('@rubi/contracts');
  if (
    !['JAHAN_ACADEMIA', 'GHESATI_RO'].every((code) =>
      LEGAL_ENTITY_CODES.includes(code),
    )
  )
    throw new Error(
      'Build the current four-company public contract before applying.',
    );
  const { createDatabaseClient } = require('@rubi/database');
  database = createDatabaseClient();
  const result = apply
    ? await createMissingCompanies(database, value('--actor-id'))
    : { applied: false };
  console.log(
    JSON.stringify(
      { ...result, companies: await inspectCompanies(database) },
      null,
      2,
    ),
  );
} catch {
  // Never print an exception that might contain a connection URL or credentials.
  console.error(
    'Local company setup failed. Verify the local environment, generated database client, existing operator and backup. No credentials are printed.',
  );
  process.exitCode = 1;
} finally {
  await database?.$disconnect();
}
