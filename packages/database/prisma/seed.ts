import { createDatabaseClient } from '../src/client';

const permissions = [
  ['iam.users.read', 'iam', 'مشاهده کاربران'],
  ['iam.users.manage', 'iam', 'مدیریت کاربران'],
  ['iam.roles.read', 'iam', 'مشاهده نقش‌ها'],
  ['iam.roles.manage', 'iam', 'مدیریت نقش‌ها و مجوزها'],
  ['iam.sessions.manage', 'iam', 'مدیریت نشست‌ها'],
  ['iam.audit.read', 'iam', 'مشاهده رویدادهای امنیتی'],
] as const;

async function seed(): Promise<void> {
  const database = createDatabaseClient();
  try {
    await database.$transaction(async (transaction) => {
      const seededPermissions = await Promise.all(
        permissions.map(([code, module, name]) =>
          transaction.permission.upsert({
            where: { code },
            create: { code, module, name },
            update: { module, name },
          }),
        ),
      );
      const administrator = await transaction.role.upsert({
        where: { code: 'administrator' },
        create: {
          code: 'administrator',
          name: 'مدیر سامانه',
          description: 'نقش سیستمی با تمام مجوزهای IAM',
          isSystem: true,
        },
        update: { isActive: true, name: 'مدیر سامانه' },
      });
      await Promise.all(
        seededPermissions.map((permission) =>
          transaction.rolePermission.upsert({
            where: {
              roleId_permissionId: {
                roleId: administrator.id,
                permissionId: permission.id,
              },
            },
            create: {
              roleId: administrator.id,
              permissionId: permission.id,
            },
            update: {},
          }),
        ),
      );
      await transaction.branch.upsert({
        where: { code: 'HQ' },
        create: { code: 'HQ', name: 'دفتر مرکزی' },
        update: { isActive: true, name: 'دفتر مرکزی' },
      });
    });
  } finally {
    await database.$disconnect();
  }
}

void seed().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'IAM seed failed.');
  process.exitCode = 1;
});
