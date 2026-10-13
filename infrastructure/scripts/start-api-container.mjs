import { spawn } from 'node:child_process';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required.');
}

const database = new URL(databaseUrl);
if (
  ['localhost', '127.0.0.1', '::1', 'host.docker.internal'].includes(
    database.hostname,
  )
) {
  database.hostname = 'postgres';
  database.port = '5432';
  process.env.DATABASE_URL = database.toString();
}

process.env.API_PORT ??= '4000';
process.env.DOCUMENTS_STORAGE_ROOT = '/srv/nora/documents';

const api = spawn(process.execPath, ['apps/api/dist/main.js'], {
  env: process.env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => api.kill(signal));
}

api.on('error', (error) => {
  console.error('Could not start the Rubi API process.', error.message);
  process.exitCode = 1;
});

api.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
