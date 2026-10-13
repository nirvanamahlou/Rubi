import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

const permissionCode = 'ui.screen.assistant.executive';
export async function executiveAccess(
  db,
  { username, apply = false, revoke = false },
) {
  if (!/^[A-Za-z0-9._-]{3,80}$/.test(username ?? ''))
    throw new Error('Invalid username');
  return db.$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { username },
        select: { id: true, status: true },
      });
      if (!user || user.status !== 'ACTIVE')
        throw new Error('Active exact username required');
      const roleCode = 'local-assistant-' + user.id;
      let role = await tx.role.findUnique({
        where: { code: roleCode },
        include: {
          users: true,
          permissions: { include: { permission: true } },
        },
      });
      if (
        role &&
        (role.isSystem ||
          !role.isActive ||
          role.users.some((entry) => entry.userId !== user.id) ||
          role.permissions.some(
            (entry) => entry.permission.code !== permissionCode,
          ))
      ) {
        throw new Error('Temporary role boundary mismatch');
      }
      const assigned =
        role?.users.some((entry) => entry.userId === user.id) ?? false;
      if (!apply)
        return {
          apply: false,
          assigned,
          operation: revoke ? 'revoke' : 'grant',
        };
      if (revoke) {
        if (role)
          await tx.userRole.deleteMany({
            where: { userId: user.id, roleId: role.id },
          });
      } else {
        const permission = await tx.permission.upsert({
          where: { code: permissionCode },
          update: {},
          create: {
            code: permissionCode,
            module: 'assistant',
            name: 'Executive assistant screen',
          },
        });
        role ??= await tx.role.create({
          data: {
            code: roleCode,
            name: 'Temporary executive assistant access',
            description:
              'Owner-authorized local development only; revoke before final rollout.',
            isSystem: false,
            isActive: true,
          },
        });
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: role.id,
              permissionId: permission.id,
            },
          },
          update: {},
          create: { roleId: role.id, permissionId: permission.id },
        });
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: role.id } },
          update: {},
          create: { userId: user.id, roleId: role.id },
        });
      }
      await tx.auditEvent.create({
        data: {
          actorUserId: null,
          action: revoke
            ? 'iam.local_assistant_access.revoke'
            : 'iam.local_assistant_access.grant',
          entityType: 'User',
          entityId: user.id,
          outcome: 'SUCCESS',
          metadata: {
            operator: 'owner-authorized local maintenance',
            workItem: 'ASSISTANT-LOCALHOST-1011',
            permission: permissionCode,
            temporary: true,
          },
        },
      });
      return {
        apply: true,
        assigned: !revoke,
        operation: revoke ? 'revoke' : 'grant',
      };
    },
    { isolationLevel: 'Serializable' },
  );
}
async function main() {
  const { values } = parseArgs({
    options: {
      username: { type: 'string' },
      'erp-root': { type: 'string' },
      apply: { type: 'boolean', default: false },
      revoke: { type: 'boolean', default: false },
    },
  });
  const root = resolve(values['erp-root'] ?? process.cwd());
  const require = createRequire(
    resolve(root, 'packages/database/package.json'),
  );
  require('dotenv').config({ path: resolve(root, '.env'), quiet: true });
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
    throw new Error('Local database required');
  }
  const { createDatabaseClient } = require('./dist/client.js');
  const db = createDatabaseClient();
  try {
    console.log(
      JSON.stringify(
        await executiveAccess(db, {
          username: values.username,
          apply: values.apply,
          revoke: values.revoke,
        }),
      ),
    );
  } finally {
    await db.$disconnect();
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    console.error(
      'Local executive access failed; no partial grant committed. No credentials logged.',
    );
    process.exitCode = 1;
  });
}
