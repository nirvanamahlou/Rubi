import { createDatabaseClient } from '../src/client';
import { PROCUREMENT_PERMISSION_SEED_DATA } from '../src/procurement-permission-seed-data';
import {
  PROCUREMENT_ROLE_SPECS,
  PROCUREMENT_STAFF_PERMISSION_CODES,
} from '../src/procurement-role-seed-data';

/** Bounded, additive live catalog sync; the fixture seed must not run here. */
async function main() {
  const database = createDatabaseClient();
  try {
    await database.$transaction(async (tx) => {
      const permissions = await Promise.all(
        PROCUREMENT_PERMISSION_SEED_DATA.map(([code, module, name]) =>
          tx.permission.upsert({
            where: { code },
            create: { code, module, name },
            update: { module, name },
          }),
        ),
      );
      const staff = await tx.role.findUnique({ where: { code: 'staff' } });
      if (!staff) throw new Error('Existing staff role is required.');
      for (const permission of permissions.filter(({ code }) =>
        PROCUREMENT_STAFF_PERMISSION_CODES.includes(code as never),
      )) {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: staff.id,
              permissionId: permission.id,
            },
          },
          create: { roleId: staff.id, permissionId: permission.id },
          update: {},
        });
      }
      for (const spec of PROCUREMENT_ROLE_SPECS) {
        const role = await tx.role.upsert({
          where: { code: spec.code },
          create: {
            code: spec.code,
            name: spec.name,
            description: 'دسترسی مشخص عملیاتی خرید در شعب مجاز',
            isSystem: true,
          },
          update: { name: spec.name, isActive: true },
        });
        for (const permission of permissions.filter(({ code }) =>
          spec.permissions.includes(code as never),
        )) {
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
    const [permissions, assignedOperationalUsers] = await Promise.all([
      database.permission.count({ where: { module: 'procurement' } }),
      database.userRole.count({
        where: {
          role: {
            code: { in: PROCUREMENT_ROLE_SPECS.map(({ code }) => code) },
          },
        },
      }),
    ]);
    process.stdout.write(
      `Procurement permission catalog: ${permissions}; approver/buyer assignments: ${assignedOperationalUsers}.\n`,
    );
  } finally {
    await database.$disconnect();
  }
}

void main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
