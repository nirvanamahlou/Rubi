// Synthetic-only local runner. Never reads the main checkout's .env or keys.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const repo = path.resolve(__dirname, '..');
const runtime = path.join(
  process.env.LOCALAPPDATA,
  'Rubi',
  'customer002b-completion',
);
const stateFile = path.join(runtime, 'private-runtime.json');
const container = 'rubi-customer002b-completion-pg';
const existing =
  spawnSync('docker', ['inspect', container], {
    windowsHide: true,
    stdio: 'ignore',
  }).status === 0;
if (!fs.existsSync(stateFile) && existing)
  throw new Error(
    'Existing test database has no key state; refusing key replacement.',
  );
if (!fs.existsSync(stateFile)) {
  fs.mkdirSync(runtime, { recursive: true });
  const key = () => crypto.randomBytes(32).toString('base64');
  fs.writeFileSync(
    stateFile,
    JSON.stringify({
      dbPassword: crypto.randomBytes(24).toString('hex'),
      encryption: key(),
      fingerprint: key(),
      jwt: key(),
      adminPassword: `Test!${crypto.randomBytes(18).toString('hex')}Aa9`,
      keyVersion: 1,
    }),
    { flag: 'wx', mode: 0o600 },
  );
}
const state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
const env = {
  ...process.env,
  NODE_ENV: 'development',
  DATABASE_URL: `postgresql://rubi_customers_test:${state.dbPassword}@127.0.0.1:55432/rubi_customers_completion?schema=public`,
  POSTGRES_PASSWORD: state.dbPassword,
  IAM_ACCESS_TOKEN_SECRET: state.jwt,
  CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64: state.encryption,
  CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64: state.fingerprint,
  CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION: String(state.keyVersion),
  API_PORT: '4002',
  API_PREFIX: 'api/v1',
  CORS_ORIGINS: 'http://127.0.0.1:3102',
  NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:4002/api/v1',
  IAM_BOOTSTRAP_ADMIN_USERNAME: 'customer002b-review',
  IAM_BOOTSTRAP_ADMIN_PASSWORD: state.adminPassword,
  IAM_BOOTSTRAP_ADMIN_NAME: 'بازبین مصنوعی مشتریان',
};
function run(command, args, cwd = repo) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: 'inherit',
    shell: command.endsWith('.cmd'),
  });
  if (result.status !== 0)
    throw new Error(`Command failed: ${command} (exit ${result.status})`);
}
const pnpm = (...args) => run('pnpm.cmd', args);
async function prepare() {
  if (!existing)
    run('docker', [
      'run',
      '-d',
      '--name',
      container,
      '-p',
      '127.0.0.1:55432:5432',
      '-e',
      'POSTGRES_PASSWORD',
      '-e',
      'POSTGRES_USER=rubi_customers_test',
      '-e',
      'POSTGRES_DB=rubi_customers_completion',
      'postgres:18.1-alpine',
    ]);
  else run('docker', ['start', container]);
  let ready = false;
  for (let i = 0; i < 30; i++) {
    if (
      spawnSync(
        'docker',
        [
          'exec',
          container,
          'pg_isready',
          '-U',
          'rubi_customers_test',
          '-d',
          'rubi_customers_completion',
        ],
        { windowsHide: true, stdio: 'ignore' },
      ).status === 0
    ) {
      ready = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error('Isolated PostgreSQL not ready.');
  run(
    'pnpm.cmd',
    ['exec', 'prisma', 'migrate', 'deploy'],
    path.join(repo, 'packages/database'),
  );
  run(
    'pnpm.cmd',
    ['exec', 'prisma', 'migrate', 'status'],
    path.join(repo, 'packages/database'),
  );
  pnpm('db:generate');
  pnpm('--filter', '@rubi/contracts', 'build');
  pnpm('--filter', '@rubi/config', 'build');
  pnpm('--filter', '@rubi/database', 'build');
  pnpm('--filter', '@rubi/database', 'db:seed');
  pnpm('--filter', '@rubi/database', 'db:seed');
  pnpm('--filter', '@rubi/api', 'build');
  pnpm('--filter', '@rubi/api', 'iam:bootstrap-admin');
}
function start() {
  const services = [
    [
      'api',
      process.execPath,
      [path.join(repo, 'apps/api/dist/main.js')],
      path.join(repo, 'apps/api'),
    ],
    [
      'web',
      process.execPath,
      [
        path.join(repo, 'apps/web/node_modules/next/dist/bin/next'),
        'start',
        '--hostname',
        '127.0.0.1',
        '--port',
        '3102',
      ],
      path.join(repo, 'apps/web'),
    ],
  ];
  for (const [name, bin, args, cwd] of services) {
    const log = fs.openSync(path.join(runtime, `${name}.log`), 'a');
    const serviceEnv = { ...env };
    if (name === 'web') serviceEnv.NODE_ENV = 'production';
    delete serviceEnv.IAM_BOOTSTRAP_ADMIN_PASSWORD;
    const child = spawn(bin, args, {
      cwd,
      env: serviceEnv,
      windowsHide: true,
      detached: true,
      stdio: ['ignore', log, log],
    });
    child.unref();
    fs.closeSync(log);
    fs.writeFileSync(path.join(runtime, `${name}.pid`), String(child.pid));
    console.log(`${name} started in isolated preview.`);
  }
}
async function main() {
  const mode = process.argv[2];
  if (mode === 'prepare') await prepare();
  else if (mode === 'start') start();
  else if (mode === 'smoke')
    await require('./customer002b-smoke.cjs')(env, state);
  else if (mode === 'database-check') {
    pnpm('db:validate');
    pnpm('--filter', '@rubi/database', 'exec', 'prisma', 'migrate', 'deploy');
    pnpm('--filter', '@rubi/database', 'exec', 'prisma', 'migrate', 'status');
  } else if (mode === 'gates') {
    pnpm('lint');
    pnpm('typecheck');
    pnpm('test');
    pnpm('build');
  } else if (mode === 'tests') {
    pnpm('--filter', '@rubi/web', 'test', 'src/modules/customers');
    pnpm('--filter', '@rubi/api', 'test', 'src/customers');
  } else
    throw new Error(
      'Use prepare, start, smoke, database-check, tests or gates. Credentials are never printed.',
    );
}
main().catch((error) => {
  if (error.code === 'ERR_ASSERTION')
    console.error(String(error.message).split('\n')[0]);
  console.error(
    'Isolated operation failed; inspect the non-secret gate output.',
  );
  process.exitCode = 1;
});
