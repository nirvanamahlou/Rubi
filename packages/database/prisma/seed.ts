import { createDatabaseClient } from '../src/client';
import { PERMISSION_SEED_DATA } from '../src/permission-seed-data';

async function seed(): Promise<void> {
  const database = createDatabaseClient();
  const fixtureActorId = '00000000-0000-0000-0000-000000000001';
  try {
    await database.$transaction(async (transaction) => {
      const seededPermissions = await Promise.all(
        PERMISSION_SEED_DATA.map(([code, module, name]) =>
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
          description: 'نقش سیستمی با تمام مجوزهای سامانه',
          isSystem: true,
        },
        update: { isActive: true, name: 'مدیر سامانه' },
      });
      await transaction.role.upsert({
        where: { code: 'staff' },
        create: {
          code: 'staff',
          name: 'کاربر عادی',
          description: 'دسترسی پایه بدون مجوز مدیریت IAM',
          isSystem: true,
        },
        update: { isActive: true, name: 'کاربر عادی' },
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
      await transaction.masterCountry.upsert({
        where: { code: 'IR' },
        create: {
          code: 'IR',
          name: 'ایران',
          englishName: 'Iran',
          createdByUserId: fixtureActorId,
          updatedByUserId: fixtureActorId,
        },
        update: { name: 'ایران', englishName: 'Iran', isActive: true },
      });
      await Promise.all(
        [
          ['IRR', 'ریال ایران', '﷼', 0],
          ['USD', 'دلار آمریکا', '$', 2],
        ].map(([code, name, symbol, decimalDigits]) =>
          transaction.masterCurrency.upsert({
            where: { code: String(code) },
            create: {
              code: String(code),
              name: String(name),
              symbol: String(symbol),
              decimalDigits: Number(decimalDigits),
              createdByUserId: fixtureActorId,
              updatedByUserId: fixtureActorId,
            },
            update: {
              name: String(name),
              symbol: String(symbol),
              decimalDigits: Number(decimalDigits),
              isActive: true,
            },
          }),
        ),
      );
      await transaction.masterAcquaintanceMethod.upsert({
        where: { code: 'REFERRAL' },
        create: {
          code: 'REFERRAL',
          name: 'معرفی دوستان',
          description: 'Fixture محلی تکرارپذیر',
          createdByUserId: fixtureActorId,
          updatedByUserId: fixtureActorId,
        },
        update: { name: 'معرفی دوستان', isActive: true },
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
