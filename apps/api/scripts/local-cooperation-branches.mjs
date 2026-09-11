// Local shared branch-reference lifecycle; IAM memberships use the public IAM service.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { JwtService } = require('@nestjs/jwt');
const { createDatabaseClient } = require('@rubi/database');
const { IamService } = require('../dist/iam/iam.service.js');
const { MfaTotpService } = require('../dist/iam/mfa-totp.js');
const [mode, actorId] = process.argv.slice(2);
if (
  !['--preview', '--apply'].includes(mode) ||
  !/^[0-9a-f-]{36}$/i.test(actorId ?? '')
)
  throw Error('Usage: --preview|--apply existing_operator_uuid');
const url = new URL(process.env.DATABASE_URL ?? '');
if (
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.port !== '55432' ||
  process.env.NODE_ENV === 'production'
)
  throw Error('Local development database required');
url.pathname = '/rubi_hr_current_20260908';
const client = createDatabaseClient(url.toString());
const definitions = [
  { code: 'NIYAYESH_SEIR', name: 'نیایش سیر' },
  { code: 'JAHAN_BASTAN', name: 'جهان باستان' },
  { code: 'JAHAN_ACADEMIA', name: 'جهان آکادمیا' },
  { code: 'GHESATI_RO', name: 'قسطی رو' },
];
try {
  const config = new ConfigService(process.env);
  const iam = new IamService(
    { client },
    new JwtService(),
    new MfaTotpService(config),
  );
  const users = await iam.listUsers();
  const user = users.find((u) => u.id === actorId && u.status === 'ACTIVE');
  if (!user) throw Error('Existing active operator required');
  const catalog = await iam.listRolesAndBranches();
  const actor = {
    userId: actorId,
    sessionId: randomUUID(),
    branchIds: user.branches.map((b) => b.branch.id),
    permissions: [
      ...new Set(
        catalog.roles
          .filter((r) => user.roles.some((u) => u.role.id === r.id))
          .flatMap((r) => r.permissions.map((p) => p.permission.code)),
      ),
    ],
  };
  iam.assertPermissions(actor, ['iam.users.manage', 'master_data.create']);
  const existing = catalog.branches;
  for (const d of definitions) {
    const matching = existing.filter(
      (b) => b.code === d.code || b.name === d.name,
    );
    if (
      matching.length > 1 ||
      matching.some((b) => !b.isActive || b.name !== d.name)
    )
      throw Error('Conflicting or inactive branch requires review: ' + d.name);
  }
  const pending = definitions.filter(
    (d) => !existing.some((b) => b.code === d.code || b.name === d.name),
  );
  let backup;
  if (mode === '--apply') {
    const info = JSON.parse(
      execFileSync('docker', ['inspect', 'rubi-postgres-1'], {
        encoding: 'utf8',
      }),
    )[0];
    const dbUser = info.Config.Env.find((e) =>
      e.startsWith('POSTGRES_USER='),
    ).slice(14);
    const bytes = execFileSync(
      'docker',
      [
        'exec',
        'rubi-postgres-1',
        'pg_dump',
        '-U',
        dbUser,
        '-d',
        'rubi_hr_current_20260908',
        '-Fc',
        '--no-owner',
        '--no-acl',
      ],
      { maxBuffer: 256 * 1024 * 1024, timeout: 60000 },
    );
    const directory = 'C:/Users/admin/Rubi-backups/cooperation-branches';
    mkdirSync(directory, { recursive: true });
    const path = directory + '/before-' + Date.now() + '.dump';
    writeFileSync(path, bytes);
    backup = { path, sha256: createHash('sha256').update(bytes).digest('hex') };
    // Add reference records only; existing IDs, names and all business rows stay unchanged.
    await client.$transaction(async (tx) => {
      for (const data of pending) await tx.branch.create({ data });
    });
    const branches = (await iam.listRolesAndBranches()).branches;
    const selected = definitions.map(
      (d) => branches.find((b) => b.name === d.name).id,
    );
    const branchIds = [...new Set([...actor.branchIds, ...selected])];
    if (branchIds.length !== actor.branchIds.length)
      await iam.updateUserAccess(
        actorId,
        { roleIds: user.roles.map((r) => r.role.id), branchIds },
        actor,
        {
          ipAddress: '127.0.0.1',
          userAgent: 'B2B-NAMED-BRANCHES-001 owner-requested local setup',
        },
      );
    const after = await iam.listUsers();
    for (const before of users) {
      const next = after.find((u) => u.id === before.id);
      if (JSON.stringify(before.roles) !== JSON.stringify(next.roles))
        throw Error('Unexpected role change');
      if (
        before.id !== actorId &&
        JSON.stringify(before.branches) !== JSON.stringify(next.branches)
      )
        throw Error('Other user access changed');
    }
    const updated = after.find((u) => u.id === actorId);
    if (
      selected.some((id) => !updated.branches.some((b) => b.branch.id === id))
    )
      throw Error('Branch membership verification failed');
  }
  console.log(
    JSON.stringify(
      {
        mode,
        pending: pending.map((b) => b.name),
        branches: definitions.map((b) => b.name),
        existingBusinessRowsPreserved: true,
        backup,
      },
      null,
      2,
    ),
  );
} finally {
  await client.$disconnect();
}
