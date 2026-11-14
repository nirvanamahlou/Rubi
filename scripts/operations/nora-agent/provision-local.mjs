/** Explicit local-only provisioning. Does not apply migrations or change ERP rows. */
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
const root = new URL('../../../', import.meta.url);
const privateFile = new URL('.env.nora-agent.local', root);
if (!process.argv.includes('--provision-local'))
  throw new Error(
    'Pass --provision-local after applying the reviewed local migration.',
  );
const originalText = readFileSync(privateFile, 'utf8');
const privateEnv = parseEnv(originalText);
const localEnv = parseEnv(readFileSync(new URL('.env', root), 'utf8'));
const originalUrl = new URL(localEnv.DATABASE_URL);
const adminUrl = new URL(originalUrl);
if (adminUrl.hostname === 'postgres') adminUrl.hostname = '127.0.0.1';
if (
  !['127.0.0.1', 'localhost'].includes(adminUrl.hostname) ||
  adminUrl.port !== '5432'
)
  throw new Error('LOCAL_DATABASE_REQUIRED');
const { Client } = createRequire(new URL('apps/api/package.json', root))('pg');
const client = new Client({ connectionString: adminUrl.toString() });
try {
  await client.connect();
  const ready = await client.query(
    "SELECT to_regclass('nora_agent.contracts') IS NOT NULL AS ready",
  );
  if (!ready.rows[0].ready)
    throw new Error(
      'Apply the reviewed nora_agent_sales_views migration first; no role was changed.',
    );
  const exists = await client.query(
    "SELECT 1 FROM pg_roles WHERE rolname='nora_agent_local'",
  );
  let url;
  if (privateEnv.ASSISTANT_AGENT_DATABASE_URL) {
    url = new URL(privateEnv.ASSISTANT_AGENT_DATABASE_URL);
    if (
      url.username !== 'nora_agent_local' ||
      url.hostname !== originalUrl.hostname ||
      url.pathname !== originalUrl.pathname
    )
      throw new Error('EXISTING_AGENT_CONFIGURATION_MISMATCH');
  } else {
    if (exists.rowCount)
      throw new Error(
        'EXISTING_ROLE_WITHOUT_LOCAL_CREDENTIALS; preserve and reconcile it manually.',
      );
    const password = randomBytes(32).toString('hex');
    await client.query(
      `CREATE ROLE nora_agent_local LOGIN PASSWORD '${password}' NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT NOBYPASSRLS`,
    );
    url = new URL(originalUrl);
    url.username = 'nora_agent_local';
    url.password = password;
    writeFileSync(
      privateFile,
      `${originalText.trimEnd()}\nASSISTANT_AGENT_DATABASE_URL=${url.toString()}\n`,
      { mode: 0o600 },
    );
  }
  await client.query('GRANT nora_agent_reader TO nora_agent_local');
  await client.query(
    'ALTER ROLE nora_agent_local SET default_transaction_read_only=on',
  );
  console.log(
    `Local SQL role configured; private settings remain in ${fileURLToPath(privateFile)}. No operational rows changed.`,
  );
} finally {
  await client.end();
}
