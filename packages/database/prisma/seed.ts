import { createCipheriv, createHmac, randomBytes } from 'node:crypto';

import { createDatabaseClient } from '../src/client';
import { PERMISSION_SEED_DATA } from '../src/permission-seed-data';

function requiredContactKey(name: string): Buffer {
  const encoded = process.env[name];
  const key = encoded ? Buffer.from(encoded, 'base64') : Buffer.alloc(0);
  if (key.length !== 32)
    throw new Error(`${name} must be configured as a base64 32-byte key.`);
  return key;
}

function protectSyntheticContact(value: string) {
  const encryptionKey = requiredContactKey(
    'CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64',
  );
  const fingerprintKey = requiredContactKey(
    'CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64',
  );
  const keyVersion = Number(
    process.env.CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION,
  );
  if (!Number.isInteger(keyVersion) || keyVersion < 1)
    throw new Error(
      'CUSTOMER_CONTACT_ENCRYPTION_KEY_VERSION must be a positive integer.',
    );
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey, iv);
  cipher.setAAD(Buffer.from('rubi:customer-contact:v1:phone', 'utf8'));
  const encryptedValue = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final(),
  ]).toString('base64');
  const valueFingerprint = createHmac('sha256', fingerprintKey)
    .update(value, 'utf8')
    .digest('hex');
  return {
    encryptedValue,
    encryptionIv: iv.toString('base64'),
    encryptionAuthTag: cipher.getAuthTag().toString('base64'),
    encryptionKeyVersion: keyVersion,
    valueFingerprint,
    valueHash: valueFingerprint,
  };
}

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
      const staff = await transaction.role.upsert({
        where: { code: 'staff' },
        create: {
          code: 'staff',
          name: 'کاربر عادی',
          description: 'دسترسی پایه بدون مجوز مدیریت IAM',
          isSystem: true,
        },
        update: { isActive: true, name: 'کاربر عادی' },
      });
      const documentRoleSpecs = [
        {
          code: 'archive_staff',
          name: 'کارشناس آرشیو',
          permissions: [
            'documents.list',
            'documents.metadata.read',
            'documents.upload',
            'documents.metadata.update',
            'documents.version.create',
            'documents.owner.change',
            'documents.category.manage',
            'documents.policy.manage',
            'documents.audit.read',
            'documents.quarantine.manage',
            'documents.delete',
            'documents.restore',
            'documents.export',
            'documents.customer_identity.read',
            'documents.sales.read',
            'documents.travel.read',
            'documents.procurement.read',
            'documents.organization.read',
            'documents.reporting.read',
            'documents.brand.read',
          ],
        },
        {
          code: 'sales_staff',
          name: 'کارشناس فروش',
          permissions: [
            'customers.read',
            'master_data.read',
            'legal-entity.read',
            'legal-entity.switch',
            'sales.contracts.read.own',
            'sales.contracts.create',
            'sales.contracts.update.own',
            'sales.contracts.confirm',
            'sales.contracts.cancel',
            'sales.payments.create',
            'sales.payments.read',
            'sales.reservation_request.create',
            'sales.export',
            'documents.list',
            'documents.metadata.read',
            'documents.file.read',
            'documents.download',
            'documents.upload',
            'documents.version.create',
            'documents.sensitive.read',
            'documents.sensitive.download',
            'documents.customer_identity.read',
            'documents.sales.read',
            'documents.travel.read',
          ],
        },
        {
          code: 'finance_staff',
          name: 'کارشناس مالی',
          permissions: [
            'documents.list',
            'documents.metadata.read',
            'documents.file.read',
            'documents.download',
            'documents.upload',
            'documents.version.create',
            'documents.sensitive.read',
            'documents.sensitive.download',
            'documents.procurement.read',
            'documents.finance.read',
          ],
        },
        {
          code: 'hr_staff',
          name: 'کارشناس منابع انسانی',
          permissions: [
            'documents.list',
            'documents.metadata.read',
            'documents.file.read',
            'documents.download',
            'documents.upload',
            'documents.version.create',
            'documents.sensitive.read',
            'documents.sensitive.download',
            'documents.hr.read',
          ],
        },
      ] as const;
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
      for (const spec of documentRoleSpecs) {
        const role = await transaction.role.upsert({
          where: { code: spec.code },
          create: {
            code: spec.code,
            name: spec.name,
            description: 'نقش سیستمی حداقلی برای عملیات ماژول مربوطه',
            isSystem: true,
          },
          update: { name: spec.name, isActive: true },
        });
        for (const permission of seededPermissions.filter(({ code }) =>
          spec.permissions.includes(code as never),
        )) {
          await transaction.rolePermission.upsert({
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
      const staffPermissionCodes = new Set([
        'legal-entity.read',
        'legal-entity.switch',
      ]);
      await Promise.all(
        seededPermissions
          .filter((permission) => staffPermissionCodes.has(permission.code))
          .map((permission) =>
            transaction.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: staff.id,
                  permissionId: permission.id,
                },
              },
              create: { roleId: staff.id, permissionId: permission.id },
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
      const initialLegalEntities = [
        {
          id: '20000000-0000-4000-8000-000000000001',
          code: 'NIYAYESH_SEIR_SAHAR',
          persianName: 'شرکت نیایش سیر سحر',
        },
        {
          id: '20000000-0000-4000-8000-000000000002',
          code: 'JAHAN_BASTAN',
          persianName: 'شرکت جهان باستان',
        },
      ] as const;
      const allowedDocumentMimeTypes = [
        'application/pdf',
        'image/png',
        'image/jpeg',
        'text/plain',
        'text/csv',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ];
      const documentTypes = [
        ['CUSTOMER_DOCUMENT', 'مدارک مشتری', 'CUSTOMER_IDENTITY', false],
        ['PASSPORT', 'پاسپورت', 'CUSTOMER_IDENTITY', true],
        ['QUOTATION', 'پیشنهاد قیمت', 'SALES', true],
        ['CONTRACT', 'قرارداد', 'SALES', true],
        ['AMENDMENT', 'الحاقیه', 'SALES', true],
        ['TICKET', 'بلیت', 'TRAVEL', true],
        ['MANIFEST', 'Manifest', 'TRAVEL', false],
        ['HOTEL_RESERVATION_FORM', 'فرم رزرو هتل', 'TRAVEL', true],
        ['VOUCHER', 'واچر', 'TRAVEL', true],
        ['INSURANCE_POLICY', 'بیمه‌نامه', 'TRAVEL', true],
        ['INVOICE', 'فاکتور', 'FINANCE', false],
        ['RECEIPT', 'رسید', 'FINANCE', false],
        ['PROCUREMENT_DOCUMENT', 'اسناد خرید', 'PROCUREMENT', false],
        ['FINANCIAL_DOCUMENT', 'اسناد مالی', 'FINANCE', false],
        ['CHECK', 'چک', 'FINANCE', true],
        ['ORGANIZATION_DOCUMENT', 'اسناد سازمانی', 'ORGANIZATION', true],
        ['HR_DOCUMENT', 'اسناد منابع انسانی', 'HUMAN_RESOURCES', true],
        ['REPORT_EXPORT', 'گزارش و خروجی', 'REPORTING', false],
        ['BRAND_ASSET_TEMPLATE', 'دارایی برند و قالب', 'BRAND', false],
      ] as const;
      for (const [code, name, domain, requiresExpiry] of documentTypes) {
        await transaction.documentType.upsert({
          where: { code },
          create: {
            code,
            name,
            domain,
            defaultConfidentiality:
              domain === 'FINANCE' || domain === 'HUMAN_RESOURCES'
                ? 'RESTRICTED'
                : domain === 'CUSTOMER_IDENTITY'
                  ? 'CONFIDENTIAL'
                  : 'INTERNAL',
            allowedMimeTypes: allowedDocumentMimeTypes,
            maxFileSizeBytes: BigInt(25 * 1024 * 1024),
            requiresExpiry,
          },
          update: {
            name,
            domain,
            allowedMimeTypes: allowedDocumentMimeTypes,
            requiresExpiry,
            isActive: true,
          },
        });
      }
      const documentCategories = [
        ['CUSTOMER_IDENTITY', 'مشتری و هویت'],
        ['SALES_CONTRACTS', 'فروش و قرارداد'],
        ['TRAVEL_RESERVATIONS', 'سفر و رزرواسیون'],
        ['PROCUREMENT_FINANCE', 'خرید و مالی'],
        ['ORGANIZATION_HR', 'سازمان و منابع انسانی'],
        ['MISSING_EXPIRED', 'مدارک ناقص و منقضی'],
        ['REPORTS_EXPORTS', 'گزارش‌ها و خروجی‌ها'],
        ['BRAND_ASSETS', 'دارایی‌های برند'],
        ['GENERAL_ARCHIVE', 'آرشیو عمومی'],
      ] as const;
      for (const [code, name] of documentCategories) {
        await transaction.documentCategory.upsert({
          where: { code },
          create: { code, name },
          update: { name, isActive: true },
        });
      }
      for (const initial of initialLegalEntities) {
        const legalEntity = await transaction.legalEntity.upsert({
          where: { code: initial.code },
          create: { ...initial, updatedByUserId: fixtureUser.id },
          update: {},
        });
        await transaction.legalEntityBrandingVersion.upsert({
          where: {
            legalEntityId_version: {
              legalEntityId: legalEntity.id,
              version: 1,
            },
          },
          create: {
            legalEntityId: legalEntity.id,
            version: 1,
            snapshot: {
              legalEntityId: legalEntity.id,
              code: legalEntity.code,
              persianName: legalEntity.persianName,
              latinName: null,
              tradeName: null,
              logoFileId: null,
              letterheadFileId: null,
              footerFileId: null,
              address: null,
              phone: null,
              email: null,
              website: null,
              nationalId: null,
              registrationNumber: null,
              economicCode: null,
              paymentText: null,
              sealFileId: null,
              authorizedSignatureId: null,
              primaryColor: null,
              secondaryColor: null,
              legalFooterText: null,
              version: 1,
            },
            createdByUserId: fixtureUser.id,
          },
          update: {},
        });
      }
      const iranCountry = await transaction.masterCountry.upsert({
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
        (
          [
            ['IRR', 'ریال ایران', 'Iranian Rial', '﷼', 0, 'SYMBOL_AFTER'],
            ['USD', 'دلار آمریکا', 'US Dollar', '$', 2, 'SYMBOL_BEFORE'],
          ] as const
        ).map(
          ([code, name, englishName, symbol, decimalDigits, displayPolicy]) =>
            transaction.masterCurrency.upsert({
              where: { code: String(code) },
              create: {
                code: String(code),
                name: String(name),
                englishName: String(englishName),
                symbol: String(symbol),
                decimalDigits: Number(decimalDigits),
                displayPolicy,
                createdByUserId: fixtureActorId,
                updatedByUserId: fixtureActorId,
              },
              update: {
                name: String(name),
                englishName: String(englishName),
                symbol: String(symbol),
                decimalDigits: Number(decimalDigits),
                displayPolicy,
                isActive: true,
              },
            }),
        ),
      );
      const tehranRegion = await transaction.masterRegion.upsert({
        where: { id: '30000000-0000-4000-8000-000000000001' },
        create: {
          id: '30000000-0000-4000-8000-000000000001',
          countryId: iranCountry.id,
          code: 'TEHRAN_PROVINCE',
          name: 'استان تهران',
          englishName: 'Tehran Province',
          type: 'PROVINCE',
          createdByUserId: fixtureActorId,
          updatedByUserId: fixtureActorId,
        },
        update: {
          countryId: iranCountry.id,
          code: 'TEHRAN_PROVINCE',
          name: 'استان تهران',
          englishName: 'Tehran Province',
          type: 'PROVINCE',
          isActive: true,
          updatedByUserId: fixtureActorId,
        },
      });
      const tehranCity = await transaction.masterCity.upsert({
        where: { id: '30000000-0000-4000-8000-000000000002' },
        create: {
          id: '30000000-0000-4000-8000-000000000002',
          countryId: iranCountry.id,
          regionId: tehranRegion.id,
          code: 'TEHRAN',
          name: 'تهران',
          englishName: 'Tehran',
          createdByUserId: fixtureActorId,
          updatedByUserId: fixtureActorId,
        },
        update: {
          countryId: iranCountry.id,
          regionId: tehranRegion.id,
          name: 'تهران',
          englishName: 'Tehran',
          isActive: true,
          updatedByUserId: fixtureActorId,
        },
      });
      const mehrabadAirport = await transaction.masterAirport.upsert({
        where: { iataCode: 'THR' },
        create: {
          id: '30000000-0000-4000-8000-000000000003',
          cityId: tehranCity.id,
          iataCode: 'THR',
          icaoCode: 'OIII',
          name: 'فرودگاه بین‌المللی مهرآباد',
          englishName: 'Mehrabad International Airport',
          ianaTimezone: 'Asia/Tehran',
          latitude: 35.6892,
          longitude: 51.3134,
          createdByUserId: fixtureActorId,
          updatedByUserId: fixtureActorId,
        },
        update: {
          cityId: tehranCity.id,
          icaoCode: 'OIII',
          name: 'فرودگاه بین‌المللی مهرآباد',
          englishName: 'Mehrabad International Airport',
          ianaTimezone: 'Asia/Tehran',
          latitude: 35.6892,
          longitude: 51.3134,
          isActive: true,
          updatedByUserId: fixtureActorId,
        },
      });
      await transaction.masterTerminal.upsert({
        where: { id: '30000000-0000-4000-8000-000000000004' },
        create: {
          id: '30000000-0000-4000-8000-000000000004',
          airportId: mehrabadAirport.id,
          code: 'TERMINAL_1',
          name: 'ترمینال یک',
          englishName: 'Terminal 1',
          terminalType: 'DOMESTIC',
          createdByUserId: fixtureActorId,
          updatedByUserId: fixtureActorId,
        },
        update: {
          airportId: mehrabadAirport.id,
          name: 'ترمینال یک',
          englishName: 'Terminal 1',
          terminalType: 'DOMESTIC',
          isActive: true,
          updatedByUserId: fixtureActorId,
        },
      });
      const syntheticPhone = '0000000000';
      const protectedSyntheticPhone = protectSyntheticContact(syntheticPhone);
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
        where: { id: '13000000-0000-4000-8000-000000000001' },
        create: {
          id: '13000000-0000-4000-8000-000000000001',
          customerId: primaryCustomer.id,
          type: 'PHONE',
          label: 'تماس ساختگی',
          maskedValue: '0000•••000',
          ...protectedSyntheticPhone,
          isPrimary: true,
          createdByUserId: fixtureUser.id,
        },
        update: {
          maskedValue: '0000•••000',
          ...protectedSyntheticPhone,
          isPrimary: true,
        },
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
