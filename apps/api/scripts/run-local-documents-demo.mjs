import { spawnSync } from 'node:child_process';
import { loadEnvFile } from 'node:process';

const [mode, ...unexpected] = process.argv.slice(2);
if (!['--preview', '--apply'].includes(mode) || unexpected.length)
  throw new Error('Specify exactly one of --preview or --apply.');

if (
  !process.env.DATABASE_URL ||
  !process.env.DOCUMENTS_STORAGE_ROOT ||
  !process.env.DOCUMENTS_STORAGE_ENCRYPTION_KEY_BASE64
) {
  loadEnvFile(
    process.env.RUBI_API_ENV_FILE ?? new URL('../.env', import.meta.url),
  );
}

const pnpmCli = process.env.npm_execpath;
if (!pnpmCli) throw new Error('Run this command through pnpm.');

function runPnpm(args) {
  const result = spawnSync(process.execPath, [pnpmCli, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`pnpm ${args.join(' ')} failed with ${result.status}.`);
}

runPnpm(['db:generate']);
runPnpm(['--filter', '@rubi/api...', 'build']);

const seedArguments = ['apps/api/scripts/seed-documents-demo.mjs', mode];
if (mode === '--apply')
  seedArguments.push('--acknowledge-local-synthetic-documents');

const seed = spawnSync(process.execPath, seedArguments, {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
});
if (seed.error) throw seed.error;
if (seed.status !== 0)
  throw new Error(`Documents demo command failed with ${seed.status}.`);
