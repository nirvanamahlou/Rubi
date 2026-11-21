import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { BankAccountService } from '../src/finance/bank-accounts/bank-account.service';
import { BankAccountCrypto } from '../src/finance/bank-accounts/bank-account.crypto';
import { MasterProcurementDirectory } from '../src/master-data/master-procurement-directory';
import { MasterDataRepository } from '../src/master-data/master-data.repository';
import { MasterDataService } from '../src/master-data/master-data.service';
import { detailOwners } from '../src/finance/accounting/detail-owners';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  financeCodingProfiles,
  type AuthenticatedActor,
} from '@nora/contracts';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import { AccountingService } from '../src/finance/accounting/accounting.service';
import { assertAccountingTestDatabase } from './accounting-test-database';

const url = process.env.FIN_CODING_TEST_DATABASE_URL;
const branchId = randomUUID();
const actor: AuthenticatedActor = {
  userId: randomUUID(),
  sessionId: randomUUID(),
  branchIds: [branchId],
  permissions: [
    'finance.read',
    'finance.journal.read',
    'finance.account.manage',
    'master_data.read',
    'master_data.create',
  ],
};
type Detail = { id: string; code: string; title: string; version: number };

describe.skipIf(!url)('FIN-CODING-001 on isolated PostgreSQL', () => {
  let db: DatabaseClient;
  let accounting: AccountingService;
  let firstBook: string;
  let otherBook: string;
  let legacyTypeId: string;
  let bankId: string;
  let bankBranchId: string;
  let bankAccounts: BankAccountService;
  const typeByBook = new Map<string, string>();
  let serial = 0;

  beforeAll(async () => {
    const fixture = new URL(url!).pathname.slice(1);
    if (!/^fin_coding_test_\d+$/.test(fixture))
      throw new Error('Fresh FIN-CODING test fixture required');
    assertAccountingTestDatabase(url!, '55437', fixture);
    db = createDatabaseClient(url);
    await db.branch.create({
      data: { id: branchId, code: branchId, name: 'Synthetic FIN-CODING' },
    });
    await db.user.create({
      data: {
        id: actor.userId,
        username: actor.userId,
        displayName: 'Synthetic accountant',
        passwordHash: 'not-a-login',
      },
    });
    accounting = new AccountingService(
      { client: db } as never,
      {
        branches: async () => [
          { id: branchId, code: 'F', name: 'Synthetic branch' },
        ],
        displayNames: async () => [],
      } as never,
    );
    firstBook = (
      await accounting.createBook(
        {
          id: randomUUID(),
          branchId,
          code: 'FC1',
          title: 'New synthetic ledger',
          baseCurrency: 'IRR',
          approvalPolicy: 'DUAL_CONTROL',
        },
        actor,
      )
    ).id;
    otherBook = (
      await db.accountingBook.create({
        data: {
          branchId,
          code: 'FC2',
          title: 'Existing synthetic ledger',
          baseCurrency: 'IRR',
        },
      })
    ).id;
    legacyTypeId = (
      await db.accountingConfiguration.create({
        data: {
          bookId: otherBook,
          kind: 'detail-types',
          code: 'LEGACY-8',
          title: 'Existing custom type',
          attributes: {
            classificationNumberLength: '8',
            defaultFirstCode: '10000000',
          },
        },
      })
    ).id;
    const holder = { client: db } as never;
    const stamp = {
      createdByUserId: actor.userId,
      updatedByUserId: actor.userId,
    };
    const country = await db.masterCountry.create({
      data: { code: 'XZ', name: 'Synthetic country', ...stamp },
    });
    const city = await db.masterCity.create({
      data: {
        code: 'QA',
        name: 'Synthetic city',
        countryId: country.id,
        ...stamp,
      },
    });
    const master = new MasterDataService(new MasterDataRepository(holder));
    const bank = await master.create(
      'banks',
      {
        code: '00123',
        name: 'Synthetic bank',
        englishName: 'Example bank',
        countryId: country.id,
        institutionKind: 'QARD_HASAN_FUND',
        publicRelationsPhone: '12345',
        website: 'https://example.invalid',
        description: 'Synthetic notes',
        descriptionEn: 'Synthetic EN',
      },
      actor,
    );
    bankId = bank.data.id;
    expect(bank.data).toMatchObject({
      code: '00123',
      attributes: {
        institutionKind: 'QARD_HASAN_FUND',
        publicRelationsPhone: '12345',
        website: 'https://example.invalid',
        descriptionEn: 'Synthetic EN',
      },
    });
    bankBranchId = (
      await master.create(
        'bank-branches',
        {
          code: '0002',
          name: 'Synthetic bank branch',
          cityId: city.id,
          bankId,
        },
        actor,
      )
    ).data.id;
    bankAccounts = new BankAccountService(
      holder,
      new MasterProcurementDirectory(holder),
      new BankAccountCrypto(
        new ConfigService({
          MASTER_DATA_IMPORT_TOKEN_KEY_BASE64: Buffer.alloc(32, 27).toString(
            'base64',
          ),
        }),
      ),
    );
    for (const bookId of [firstBook, otherBook]) {
      const type = await db.accountingConfiguration.create({
        data: {
          bookId,
          kind: 'bank-account-types',
          code: 'CHECKING',
          title: 'Checking',
          attributes: {},
        },
      });
      typeByBook.set(bookId, type.id);
    }
  }, 30000);

  const accountInput = (bookId: string) => {
    serial += 1;
    return {
      requestId: randomUUID(),
      title: 'Synthetic account ' + serial,
      branchId,
      currencyCode: 'IRR',
      isActive: true,
      accountNumber: String(serial).padStart(9, '0'),
      treasury: {
        treasuryBookId: bookId,
        bankAccountTypeId: typeByBook.get(bookId)!,
        bankBranchId,
      },
    };
  };
  async function source(bookId: string, prefix: string) {
    if (prefix !== '5') return {};
    return {
      sourceAccountId: (
        await bankAccounts.save(bankId, null, accountInput(bookId), actor)
      ).id,
    };
  }
  afterAll(async () => {
    await db?.$disconnect();
  });

  function run<T>(
    bookId: string,
    action: string,
    payload: Record<string, unknown>,
    expectedVersion?: number,
    who = actor,
    key = randomUUID(),
  ) {
    return accounting.command(
      bookId,
      action,
      { key, payload, expectedVersion },
      who,
    ) as Promise<T>;
  }
  async function typeId(bookId: string, code: string) {
    return (
      await db.accountingConfiguration.findFirstOrThrow({
        where: { bookId, kind: 'detail-types', code },
      })
    ).id;
  }

  it('defines the four categories under the existing ledger permission and preserves same-title records', async () => {
    const readOnly = {
      ...actor,
      permissions: ['finance.read', 'finance.journal.read'],
    } as AuthenticatedActor;
    await expect(
      run(otherBook, 'setup-finance-coding-types', {}, undefined, readOnly),
    ).rejects.toMatchObject({ status: 403 });
    const protectedBook = await db.accountingBook.create({
      data: {
        branchId,
        code: 'FC3',
        title: 'Synthetic conflict ledger',
        baseCurrency: 'IRR',
      },
    });
    const conflict = await db.accountingConfiguration.create({
      data: {
        bookId: protectedBook.id,
        kind: 'detail-types',
        code: 'LEGACY-BANK',
        title: 'حساب های بانکی',
        attributes: { classificationNumberLength: '7' },
      },
    });
    await expect(
      run(protectedBook.id, 'setup-finance-coding-types', {}),
    ).resolves.toEqual({
      created: 3,
      conflicts: ['حساب‌های بانکی'],
    });
    expect(
      await db.accountingConfiguration.findUnique({
        where: { id: conflict.id },
      }),
    ).toEqual(conflict);
    await expect(
      run(otherBook, 'setup-finance-coding-types', {}),
    ).resolves.toEqual({ created: 4, conflicts: [] });
    await expect(
      run(otherBook, 'setup-finance-coding-types', {}),
    ).resolves.toEqual({ created: 0, conflicts: [] });
    for (const profile of financeCodingProfiles) {
      const saved = await db.accountingConfiguration.findUniqueOrThrow({
        where: {
          id: await typeId(firstBook, profile.typeCode),
        },
      });
      expect(saved).toMatchObject({
        title: profile.title,
        attributes: {
          isSystem: true,
          classificationNumberLength: '8',
          defaultFirstCode: profile.firstCode,
        },
      });
      await expect(
        run(
          firstBook,
          'save-configuration',
          {
            ...saved,
            attributes: {
              ...(saved.attributes as object),
              classificationNumberLength: '7',
            },
          },
          saved.version,
        ),
      ).rejects.toMatchObject({ status: 422 });
    }
  });

  it('issues the first three per type across two ledgers, serializes concurrent writes and replays a request', async () => {
    for (const profile of financeCodingProfiles) {
      const first = {
        typeId: await typeId(firstBook, profile.typeCode),
        title: 'Synthetic first',
        ...(await source(firstBook, profile.prefix)),
      };
      const second = {
        typeId: await typeId(otherBook, profile.typeCode),
        title: 'Synthetic next',
        ...(await source(otherBook, profile.prefix)),
      };
      const key = randomUUID();
      for (const illegal of [
        profile.prefix + '0000000',
        '10000001',
        profile.prefix + '001',
        profile.firstCode,
      ]) {
        await expect(
          run(firstBook, 'save-detail', { ...first, code: illegal }),
        ).rejects.toMatchObject({ status: 422 });
      }
      const saved = await run<Detail>(
        firstBook,
        'save-detail',
        first,
        undefined,
        actor,
        key,
      );
      expect(saved.code).toBe(profile.firstCode);
      expect(
        await run<Detail>(
          firstBook,
          'save-detail',
          first,
          undefined,
          actor,
          key,
        ),
      ).toEqual(saved);
      const following = await Promise.all([
        run<Detail>(firstBook, 'save-detail', first),
        run<Detail>(otherBook, 'save-detail', second),
      ]);
      expect(following.map((row) => row.code).sort()).toEqual([
        profile.prefix + '0000002',
        profile.prefix + '0000003',
      ]);
      expect(
        await db.systemIssuedNumber.findUnique({
          where: { issuedValue: saved.code },
        }),
      ).toMatchObject({
        actorUserId: actor.userId,
        idempotencyKey: 'accounting-detail:' + saved.id,
      });
    }
  });

  it('skips occupied legacy values, preserves issued and legacy codes, and does not recycle deleted codes', async () => {
    const profile = financeCodingProfiles[3];
    const type = await typeId(firstBook, profile.typeCode);
    const latest = await db.accountingDetail.findFirstOrThrow({
      where: { typeId: type, code: '50000001' },
    });
    await expect(
      run(
        firstBook,
        'save-detail',
        { id: latest.id, typeId: type, title: latest.title, code: '50000009' },
        1,
      ),
    ).rejects.toMatchObject({ status: 422 });
    await run(
      firstBook,
      'delete-base-record',
      { entity: 'detail', id: latest.id },
      latest.version,
    );
    const legacy = await run<Detail>(otherBook, 'save-detail', {
      typeId: legacyTypeId,
      title: 'Legacy bank-like code',
      code: '50000004',
      active: false,
    });
    const allocated = await run<Detail>(firstBook, 'save-detail', {
      typeId: type,
      title: 'Another bank detail',
      ...(await source(firstBook, profile.prefix)),
    });
    expect(allocated.code).toBe('50000005');
    expect(
      await db.accountingDetail.findUnique({ where: { id: legacy.id } }),
    ).toMatchObject({ code: '50000004', active: false });
    expect(
      await db.systemIssuedNumber.findUnique({
        where: { issuedValue: latest.code },
      }),
    ).toBeTruthy();
    await expect(
      run(otherBook, 'save-detail', {
        typeId: legacyTypeId,
        title: 'Conflicting number',
        code: latest.code,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('round-trips profile fields and masks identifiers in the title list', async () => {
    const backup = await bankAccounts.save(
      bankId,
      null,
      accountInput(firstBook),
      actor,
    );
    const unrelated = await bankAccounts.save(
      bankId,
      null,
      accountInput(otherBook),
      actor,
    );
    const person = await db.customer.create({
      data: {
        kind: 'PERSON',
        firstName: 'Synthetic',
        lastName: 'signer',
        displayName: 'Synthetic signer',
        ownerBranchId: branchId,
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
      },
    });
    const method = await db.masterPaymentMethod.create({
      data: {
        code: 'QA-TRANSFER',
        name: 'Synthetic transfer',
        channel: 'BANK_TRANSFER',
        direction: 'PAYMENT',
        createdByUserId: actor.userId,
        updatedByUserId: actor.userId,
      },
    });
    const input = {
      ...accountInput(firstBook),
      bankProfile: {
        creditLimit: '۰۰۲۵٫۵۰',
        reserveBalance: '100',
        materiality: '1.25',
        backupAccountId: backup.id,
        automaticTransfer: true,
        transferMethodId: method.id,
        description: 'Synthetic profile',
        descriptionEn: 'Synthetic EN',
        notes: 'Synthetic notes',
        signerIds: [person.id, person.id],
      },
    };
    await expect(
      bankAccounts.save(
        bankId,
        null,
        {
          ...input,
          bankProfile: { ...input.bankProfile, backupAccountId: unrelated.id },
        },
        actor,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      await db.financeSettlementAccount.findUnique({
        where: { id: input.requestId },
      }),
    ).toBeNull();
    const account = await bankAccounts.save(bankId, null, input, actor);
    expect(await bankAccounts.save(bankId, null, input, actor)).toEqual(
      account,
    );
    await expect(
      bankAccounts.save(
        bankId,
        null,
        { ...input, bankProfile: { ...input.bankProfile, notes: 'Different' } },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
    const loaded = await bankAccounts.details(bankId, account.id, actor);
    expect(loaded.bankProfile).toMatchObject({
      creditLimit: '25.5',
      reserveBalance: '100',
      materiality: '1.25',
      notes: 'Synthetic notes',
      backupAccountId: backup.id,
      transferMethodId: method.id,
      signers: [{ id: person.id, name: 'Synthetic signer' }],
    });
    expect(loaded.accountNumber).toBe(input.accountNumber);
    const owners = await detailOwners(
      db,
      { id: firstBook, branchId, baseCurrency: 'IRR' },
      { kind: 'BANK', search: 'Synthetic bank branch' },
    );
    const row = owners.rows.find((item) => item.id === account.id);
    expect(row?.attributes).toMatchObject({
      bankName: 'Synthetic bank',
      bankCode: '00123',
      bankBranchCode: '0002',
      bankAccountType: 'Checking',
    });
    expect(row?.attributes.maskedAccountNumber).not.toBe(input.accountNumber);
    expect(owners.rows.some((item) => item.id === unrelated.id)).toBe(false);
    const { requestId, ...savedInput } = input;
    expect(account.id).toBe(requestId);
    await bankAccounts.save(
      bankId,
      account.id,
      {
        ...savedInput,
        expectedVersion: account.version,
        bankProfile: { ...input.bankProfile, signerIds: [] },
      },
      actor,
    );
    expect(
      (await bankAccounts.details(bankId, account.id, actor)).bankProfile
        ?.signers,
    ).toEqual([]);
    await expect(
      bankAccounts.save(
        bankId,
        account.id,
        { ...savedInput, expectedVersion: account.version },
        actor,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});
