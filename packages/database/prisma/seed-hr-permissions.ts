import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

import { createDatabaseClient } from '../src/client';
import { PERMISSION_SEED_DATA } from '../src/permission-seed-data';

/** Explicit local maintenance. This script never creates/changes users or credentials. */
async function main() {
  const env = parseEnv(
    readFileSync(
      process.env.RUBI_HR_ENV_FILE ??
        resolve(process.cwd(), '../../apps/api/.env'),
      'utf8',
    ),
  );
  const url = new URL(env.DATABASE_URL!);
  if (
    env.NODE_ENV === 'production' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.port !== '55432'
  )
    throw new Error(
      'Only the authorized local development PostgreSQL target is allowed.',
    );
  const client = createDatabaseClient(url.toString());
  try {
    const roles = await client.role.findMany({
      where: { code: { in: ['administrator', 'hr_staff'] }, isActive: true },
      select: { id: true, code: true },
    });
    const specs = PERMISSION_SEED_DATA.filter(([code]) =>
      code.startsWith('hr.'),
    );
    const apply = process.argv.includes('--apply');
    if (apply)
      await client.$transaction(async (tx) => {
        for (const [code, module, name] of specs) {
          const permission = await tx.permission.upsert({
            where: { code },
            create: { code, module, name },
            update: { module, name },
          });
          for (const role of roles) {
            // Receiving a shared personnel referral requires an explicit role assignment.
            if (code.startsWith('hr.connections.')) continue;
            if (
              role.code === 'hr_staff' &&
              !['hr.read', 'hr.manage', 'hr.sensitive', 'hr.audit'].includes(
                code,
              )
            )
              continue;
            await tx.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: role.id,
                  permissionId: permission.id,
                },
              },
              create: { roleId: role.id, permissionId: permission.id },
              update: {},
            });
          }
        }
      });
    process.stdout.write(
      JSON.stringify({
        apply,
        permissions: specs.length,
        roles: roles.map((role) => role.code),
        usersChanged: 0,
      }) + '\n',
    );
  } finally {
    await client.$disconnect();
  }
}
void main().catch(() => {
  process.stderr.write(
    'HR permission maintenance failed; no credentials were changed.\n',
  );
  process.exitCode = 1;
});
