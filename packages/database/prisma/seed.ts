import { createHash } from 'node:crypto';

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
      const fixtureBranch = await transaction.branch.upsert({
        where: { code: 'HQ' },
        create: { code: 'HQ', name: 'دفتر مرکزی' },
        update: { isActive: true, name: 'دفتر مرکزی' },
      });
      const fixtureUser = await transaction.user.upsert({
        where: { id: fixtureActorId },
        create: {
          id: fixtureActorId,
          username: 'customer-fixture-admin',
          displayName: 'مدیر ساختگی Customer Fixture',
          passwordHash:
            '$argon2id$v=19$m=65536,t=3,p=1$synthetic$fixture-only-not-login-capable',
        },
        update: {
          displayName: 'مدیر ساختگی Customer Fixture',
          status: 'ACTIVE',
        },
      });
      await transaction.userRole.upsert({
        where: {
          userId_roleId: { userId: fixtureUser.id, roleId: administrator.id },
        },
        create: { userId: fixtureUser.id, roleId: administrator.id },
        update: {},
      });
      await transaction.userBranch.upsert({
        where: {
          userId_branchId: {
            userId: fixtureUser.id,
            branchId: fixtureBranch.id,
          },
        },
        create: {
          userId: fixtureUser.id,
          branchId: fixtureBranch.id,
          isPrimary: true,
        },
        update: { isPrimary: true },
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
      const syntheticPhone = ['+98', '912', '000', '1234'].join('');
      const syntheticPhoneHash = createHash('sha256')
        .update(syntheticPhone)
        .digest('hex');
      const primaryCustomer = await transaction.customer.upsert({
        where: { id: '10000000-0000-4000-8000-000000000001' },
        create: {
          id: '10000000-0000-4000-8000-000000000001',
          kind: 'PERSON',
          firstName: 'نمونه',
          lastName: 'آزمایشی',
          displayName: 'مشتری ساختگی شماره یک',
          birthDate: new Date('1990-01-01T00:00:00.000Z'),
          isCustomer: true,
          isPassenger: true,
          ownerBranchId: fixtureBranch.id,
          createdByUserId: fixtureUser.id,
          updatedByUserId: fixtureUser.id,
        },
        update: { displayName: 'مشتری ساختگی شماره یک', isActive: true },
      });
      const companionCustomer = await transaction.customer.upsert({
        where: { id: '10000000-0000-4000-8000-000000000002' },
        create: {
          id: '10000000-0000-4000-8000-000000000002',
          kind: 'PERSON',
          firstName: 'همراه',
          lastName: 'ساختگی',
          displayName: 'مسافر همراه ساختگی',
          isCustomer: false,
          isPassenger: true,
          ownerBranchId: fixtureBranch.id,
          createdByUserId: fixtureUser.id,
          updatedByUserId: fixtureUser.id,
        },
        update: { displayName: 'مسافر همراه ساختگی', isActive: true },
      });
      await transaction.customerContact.upsert({
        where: {
          customerId_type_valueHash: {
            customerId: primaryCustomer.id,
            type: 'PHONE',
            valueHash: syntheticPhoneHash,
          },
        },
        create: {
          customerId: primaryCustomer.id,
          type: 'PHONE',
          label: 'تماس ساختگی',
          maskedValue: '+989•••234',
          valueHash: syntheticPhoneHash,
          isPrimary: true,
          createdByUserId: fixtureUser.id,
        },
        update: { maskedValue: '+989•••234', isPrimary: true },
      });
      await transaction.customerAddress.upsert({
        where: { id: '11000000-0000-4000-8000-000000000001' },
        create: {
          id: '11000000-0000-4000-8000-000000000001',
          customerId: primaryCustomer.id,
          type: 'HOME',
          label: 'نشانی کاملاً ساختگی',
          isPrimary: true,
          createdByUserId: fixtureUser.id,
        },
        update: { label: 'نشانی کاملاً ساختگی', isPrimary: true },
      });
      await transaction.customerConsent.upsert({
        where: { id: '12000000-0000-4000-8000-000000000001' },
        create: {
          id: '12000000-0000-4000-8000-000000000001',
          customerId: primaryCustomer.id,
          purpose: 'MARKETING',
          channel: 'ALL',
          status: 'REVOKED',
          source: 'synthetic-fixture',
          reason: 'مقدار امن پیش‌فرض Fixture',
          occurredAt: new Date('2026-08-24T00:00:00.000Z'),
          recordedByUserId: fixtureUser.id,
        },
        update: { status: 'REVOKED', reason: 'مقدار امن پیش‌فرض Fixture' },
      });
      await transaction.customerRelationship.upsert({
        where: {
          customerId_relatedCustomerId_relationshipType: {
            customerId: primaryCustomer.id,
            relatedCustomerId: companionCustomer.id,
            relationshipType: 'COMPANION',
          },
        },
        create: {
          customerId: primaryCustomer.id,
          relatedCustomerId: companionCustomer.id,
          relationshipType: 'COMPANION',
          createdByUserId: fixtureUser.id,
        },
        update: {},
      });
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
