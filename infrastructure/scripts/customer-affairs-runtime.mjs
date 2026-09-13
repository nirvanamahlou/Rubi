// Bounded local deployment helper. Load credentials with node --env-file.
// No global seed, credential reset, user-role assignment or unrelated migration.
import { randomUUID } from 'node:crypto';
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [mode = 'inspect', database] = process.argv.slice(2);
if (
  !['inspect', 'migrate', 'grant-administrator'].includes(mode) ||
  !['rubi_hr_current_20260908', 'rubi_ca_unified_verify_20260912'].includes(
    database,
  )
)
  throw new Error(
    'An explicit supported action and local database are required.',
  );
const url = new URL(process.env.DATABASE_URL);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55432')
  throw new Error(
    'Only the existing local Rubi PostgreSQL instance is supported.',
  );
url.pathname = `/${database}`;
const databaseDirectory = fileURLToPath(
  new URL('../../packages/database/', import.meta.url),
);
const requireDatabase = createRequire(
  new URL('../../packages/database/package.json', import.meta.url),
);
const { Client } = requireDatabase('pg');
const client = new Client({ connectionString: url.toString() });
await client.connect();
try {
  const applied = await client.query(
    'SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL',
  );
  const names = new Set(applied.rows.map((row) => row.migration_name));
  const missing = readdirSync(`${databaseDirectory}/prisma/migrations`, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory() && !names.has(entry.name))
    .map((entry) => entry.name);
  const unfinished = await client.query(
    'SELECT count(*)::int AS count FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL',
  );
  if (unfinished.rows[0].count)
    throw new Error('Resolve the existing failed migration before proceeding.');
  if (mode === 'migrate') {
    if (
      missing.some(
        (name) => name !== '20260912173000_customer_affairs_operational',
      )
    )
      throw new Error(`Unrelated pending migrations: ${missing.join(', ')}`);
    const result = spawnSync(
      process.execPath,
      [
        `${databaseDirectory}/node_modules/prisma/build/index.js`,
        'migrate',
        'deploy',
      ],
      {
        cwd: databaseDirectory,
        env: { ...process.env, DATABASE_URL: url.toString() },
        stdio: 'inherit',
      },
    );
    if (result.status !== 0) throw new Error('Migration did not succeed.');
  }
  if (mode === 'grant-administrator') {
    const { PERMISSION_SEED_DATA } = requireDatabase(
      './dist/permission-seed-data.js',
    );
    const permissions = PERMISSION_SEED_DATA.filter(([code]) =>
      code.startsWith('customer_affairs.'),
    );
    await client.query('BEGIN');
    try {
      const role = await client.query(
        'SELECT id FROM iam_roles WHERE code=$1 AND "isActive"=true AND "isSystem"=true FOR UPDATE',
        ['administrator'],
      );
      if (role.rowCount !== 1)
        throw new Error(
          'Existing active system administrator role is required.',
        );
      let granted = 0;
      for (const [code, module, name] of permissions) {
        await client.query(
          'INSERT INTO iam_permissions (id,code,module,name) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING',
          [randomUUID(), code, module, name],
        );
        const result = await client.query(
          'INSERT INTO iam_role_permissions ("roleId","permissionId") SELECT $1,id FROM iam_permissions WHERE code=$2 ON CONFLICT DO NOTHING',
          [role.rows[0].id, code],
        );
        granted += result.rowCount;
      }
      if (granted)
        await client.query(
          'INSERT INTO iam_audit_events (id,action,"entityType","entityId",outcome,metadata) VALUES ($1,$2,$3,$4,$5,$6)',
          [
            randomUUID(),
            'local.customer_affairs.permissions.install',
            'Role',
            role.rows[0].id,
            'SUCCESS',
            JSON.stringify({
              task: 'UNIFIED-CUSTOMER-AFFAIRS-3100',
              authorization: 'Explicit user approval: administrator only',
              permissions: permissions.map(([code]) => code),
              granted,
            }),
          ],
        );
      await client.query('COMMIT');
      console.log(
        JSON.stringify({
          database,
          administratorPermissionsAdded: granted,
          otherRolesChanged: false,
        }),
      );
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
  const counts = await client.query(
    'SELECT (SELECT count(*) FROM iam_users) AS users, (SELECT count(*) FROM branches) AS branches, (SELECT count(*) FROM documents) AS documents',
  );
  const tables = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'customer_affairs_%' ORDER BY tablename",
  );
  console.log(
    JSON.stringify({
      database,
      missingBeforeAction: missing,
      counts: counts.rows[0],
      customerAffairsTables: tables.rows.length,
    }),
  );
} finally {
  await client.end();
}
