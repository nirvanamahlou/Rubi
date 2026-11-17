import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import {
  accountingDetailOwners,
  type AccountingDetailOwnerV1,
  type AccountingDetailV1,
  type AuthenticatedActor,
} from '@nora/contracts';
import { AccountingService } from '../src/finance/accounting/accounting.service';
import { detailOwners } from '../src/finance/accounting/detail-owners';
const url = process.env.DETAIL_OWNER_TEST_DATABASE_URL;
describe.skipIf(!url)('typed detail owners on disposable PostgreSQL', () => {
  let db: DatabaseClient,
    api: AccountingService,
    bookId: string,
    otherBookId: string,
    personId: string;
  const branchId = randomUUID(),
    actorId = randomUUID();
  const actor: AuthenticatedActor = {
    userId: actorId,
    sessionId: randomUUID(),
    branchIds: [branchId],
    permissions: [
      'finance.read',
      'finance.journal.read',
      'finance.account.manage',
    ],
  };
  const act = <T>(
    action: string,
    payload: Record<string, unknown>,
    expectedVersion?: number,
    key = randomUUID(),
  ) =>
    api.command(
      bookId,
      action,
      {
        key,
        payload,
        ...(expectedVersion === undefined ? {} : { expectedVersion }),
      },
      actor,
    ) as Promise<T>;
  beforeAll(async () => {
    const parsed = new URL(url!);
    if (
      parsed.hostname !== '127.0.0.1' ||
      parsed.port !== '55594' ||
      parsed.pathname !== '/detail_owner_test'
    )
      throw Error('Disposable database only');
    db = createDatabaseClient(url!);
    await db.branch.create({
      data: { id: branchId, code: randomUUID(), name: 'Synthetic owner forms' },
    });
    await db.user.create({
      data: {
        id: actorId,
        username: randomUUID(),
        displayName: 'Synthetic operator',
        passwordHash: 'not-a-credential',
      },
    });
    const data = {
      branchId,
      code: randomUUID().slice(0, 12),
      title: 'Synthetic book',
      baseCurrency: 'IRR',
    };
    bookId = (await db.accountingBook.create({ data })).id;
    otherBookId = (
      await db.accountingBook.create({
        data: { ...data, code: randomUUID().slice(0, 12) },
      })
    ).id;
    const personType = await db.accountingConfiguration.create({
      data: {
        bookId,
        kind: 'detail-types',
        code: 'PERSON',
        title: 'شخص',
        attributes: { isSystem: true, classificationNumberLength: '6' },
      },
    });
    personId = (
      await db.accountingDetail.create({
        data: {
          bookId,
          typeId: personType.id,
          code: '000001',
          title: 'Synthetic cashier',
          attributes: {},
        },
      })
    ).id;
    await db.masterCurrency.upsert({
      where: { code: 'IRR' },
      update: { isActive: true },
      create: {
        code: 'IRR',
        name: 'Synthetic rial',
        createdByUserId: actorId,
        updatedByUserId: actorId,
      },
    });
    api = new AccountingService(
      { client: db } as never,
      { displayNames: async () => [] } as never,
    );
  }, 30000);
  afterAll(async () => {
    await db?.$disconnect();
  });
  it('adds only missing eight-digit definitions and preserves pre-existing widths and IDs', async () => {
    const legacy = await db.accountingConfiguration.create({
      data: {
        bookId,
        kind: 'detail-types',
        code: 'LEGACYBANK',
        title: 'حساب بانکی',
        attributes: { classificationNumberLength: '5' },
        active: false,
      },
    });
    const migration = readFileSync(
      resolve(
        '../../packages/database/prisma/migrations/20261117200000_detail_owner_sources/migration.sql',
      ),
      'utf8',
    );
    const seed = migration
      .slice(
        migration.indexOf('INSERT INTO accounting_configurations'),
        migration.lastIndexOf('COMMIT;'),
      )
      .trim();
    await db.$executeRawUnsafe(seed);
    await db.$executeRawUnsafe(seed);
    expect(
      await db.accountingConfiguration.findUnique({ where: { id: legacy.id } }),
    ).toEqual(legacy);
    const types = await db.accountingConfiguration.findMany({
      where: { bookId, kind: 'detail-types' },
    });
    expect(types).toHaveLength(9);
    for (const def of accountingDetailOwners.filter((d) => d.kind !== 'BANK'))
      expect(
        types.find((t) => t.title === def.title)?.attributes,
      ).toMatchObject({ classificationNumberLength: '8', isSystem: true });
  });
  const records: Record<string, AccountingDetailOwnerV1> = {};
  for (const def of accountingDetailOwners.filter((d) => d.kind !== 'BANK')) {
    it('creates, selects, reloads and edits ' + def.kind, async () => {
      const attributes = {
        notes: def.kind === 'FISCAL_YEAR' ? '[]' : 'Synthetic note',
        isMain: false,
        centerType: 'تولیدی',
        fundType: 'ملی',
        fundClass: 'سنواتی',
        creditClass: 'بدون طبقه',
        operatorId: personId,
        location: 'Synthetic office',
      };
      const payload = {
        ownerKind: def.kind,
        code: '00000001',
        title: 'Synthetic ' + def.kind,
        currency: 'IRR',
        attributes,
      };
      const key = randomUUID(),
        row = await act<AccountingDetailOwnerV1>(
          'save-detail-owner',
          payload,
          undefined,
          key,
        );
      records[def.kind] = row;
      expect(await act('save-detail-owner', payload, undefined, key)).toEqual(
        row,
      );
      const type = await db.accountingConfiguration.findFirstOrThrow({
        where: { bookId, kind: 'detail-types', title: def.title },
      });
      const detail = await act<AccountingDetailV1>('save-detail', {
        typeId: type.id,
        title: 'Untrusted title',
        code: '',
        sourceConfigurationId: row.configurationId ?? '',
        sourceAccountId: row.accountId ?? '',
        attributes: {},
      });
      expect(detail.title).toBe(row.title);
      expect(detail.code).toBe('00000000');
      expect(detail.sourceConfigurationId).toBe(row.configurationId);
      const reloaded = await api.snapshot(bookId, actor);
      expect(
        reloaded.details.find((d) => d.id === detail.id)?.sourceAccountId,
      ).toBe(row.accountId);
      const updated = await act<AccountingDetailOwnerV1>(
        'save-detail-owner',
        { ...payload, id: row.id, title: row.title + ' edited' },
        row.version,
      );
      expect(updated.version).toBe(row.version + 1);
      expect(updated.title).toContain('edited');
      await expect(
        act(
          'save-detail-owner',
          { ...payload, id: row.id, title: 'Stale' },
          row.version,
        ),
      ).rejects.toThrow();
      await expect(
        db.accountingConfiguration.delete({ where: { id: row.id } }),
      ).rejects.toThrow();
      if (row.accountId)
        expect(
          (
            await db.treasuryInstrument.findUniqueOrThrow({
              where: { id: row.accountId },
            })
          ).bookId,
        ).toBe(bookId);
    });
  }
  it('rejects cross-book references, missing fields, unauthorized writes and a fabricated bank owner', async () => {
    const type = await db.accountingConfiguration.findFirstOrThrow({
      where: { bookId: otherBookId, kind: 'detail-types', title: 'شعبه' },
    });
    await expect(
      api.command(
        otherBookId,
        'save-detail',
        {
          key: randomUUID(),
          payload: {
            typeId: type.id,
            title: 'x',
            attributes: {},
            sourceConfigurationId: records.BRANCH!.id,
          },
        },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      act('save-detail-owner', {
        ownerKind: 'FUND',
        title: 'missing code',
        attributes: {},
      }),
    ).rejects.toThrow();
    await expect(
      act('save-detail-owner', {
        ownerKind: 'CASH',
        title: 'Missing operator',
        code: '02',
        currency: 'IRR',
        attributes: {},
      }),
    ).rejects.toThrow();
    await expect(
      act('save-detail-owner', {
        ownerKind: 'BANK',
        title: 'Forbidden bank',
        code: '02',
        attributes: {},
      }),
    ).rejects.toThrow();
    await expect(
      api.command(
        bookId,
        'save-detail-owner',
        {
          key: randomUUID(),
          payload: {
            ownerKind: 'PROJECT',
            title: 'x',
            code: '02',
            attributes: {},
          },
        },
        { ...actor, permissions: ['finance.read', 'finance.journal.read'] },
      ),
    ).rejects.toThrow();
  });
  it('rejects multiple main branches and source-type mismatches', async () => {
    const payload = {
      id: records.BRANCH!.id,
      ownerKind: 'BRANCH',
      code: '00000001',
      title: 'Main branch',
      attributes: { isMain: true },
    };
    await act('save-detail-owner', payload, 2);
    await expect(
      act('save-detail-owner', { ...payload, id: undefined, code: '00000002' }),
    ).rejects.toThrow();
    const type = await db.accountingConfiguration.findFirstOrThrow({
      where: { bookId, kind: 'detail-types', title: 'پروژه' },
    });
    await expect(
      act('save-detail', {
        typeId: type.id,
        title: 'x',
        sourceConfigurationId: records.BRANCH!.id,
        attributes: {},
      }),
    ).rejects.toThrow();
  });

  it('selects a real bank account and retains the restrictive link', async () => {
    const country = await db.masterCountry.upsert({
      where: { code: 'XZ' },
      update: {},
      create: {
        code: 'XZ',
        name: 'Synthetic country',
        createdByUserId: actorId,
        updatedByUserId: actorId,
      },
    });
    const city = await db.masterCity.create({
      data: {
        code: randomUUID().slice(0, 16),
        name: 'Synthetic city',
        countryId: country.id,
        createdByUserId: actorId,
        updatedByUserId: actorId,
      },
    });
    const bank = await db.masterBank.create({
      data: {
        countryId: country.id,
        code: randomUUID().replaceAll('-', ''),
        name: 'Synthetic bank',
        createdByUserId: actorId,
        updatedByUserId: actorId,
      },
    });
    const bankBranch = await db.masterBankBranch.create({
      data: {
        bankId: bank.id,
        cityId: city.id,
        code: '001',
        name: 'Synthetic branch',
        createdByUserId: actorId,
        updatedByUserId: actorId,
      },
    });
    const bankType = await db.accountingConfiguration.create({
      data: {
        bookId: otherBookId,
        kind: 'bank-account-types',
        code: 'TEST',
        title: 'Synthetic type',
        attributes: {},
      },
    });
    const account = await db.financeSettlementAccount.create({
      data: {
        branchId,
        kind: 'BANK',
        title: 'Synthetic native bank',
        currencyCode: 'IRR',
        createdByUserId: actorId,
        treasuryBookId: otherBookId,
        bankId: bank.id,
        bankBranchId: bankBranch.id,
        bankAccountTypeId: bankType.id,
      },
    });
    const type = await db.accountingConfiguration.findFirstOrThrow({
      where: { bookId: otherBookId, kind: 'detail-types', title: 'حساب بانکی' },
    });
    const invisible = await db.$transaction((tx) =>
      detailOwners(
        tx,
        { id: bookId, branchId, baseCurrency: 'IRR' },
        { kind: 'BANK', id: account.id },
      ),
    );
    expect(invisible.rows).toHaveLength(0);
    const unassigned = await db.financeSettlementAccount.create({
      data: {
        branchId,
        kind: 'BANK',
        title: 'Synthetic unassigned bank',
        currencyCode: 'IRR',
        createdByUserId: actorId,
      },
    });
    await expect(
      api.command(
        otherBookId,
        'save-detail',
        {
          key: randomUUID(),
          payload: {
            typeId: type.id,
            title: 'Unassigned',
            sourceAccountId: unassigned.id,
            attributes: {},
          },
        },
        actor,
      ),
    ).rejects.toThrow();

    const result = (await api.command(
      otherBookId,
      'save-detail',
      {
        key: randomUUID(),
        payload: {
          typeId: type.id,
          title: 'Forged bank title',
          sourceAccountId: account.id,
          attributes: {},
        },
      },
      actor,
    )) as unknown as AccountingDetailV1;
    expect(result.title).toBe(account.title);
    expect(result.sourceAccountId).toBe(account.id);
    expect(result.code).toHaveLength(8);
    await expect(
      db.financeSettlementAccount.delete({ where: { id: account.id } }),
    ).rejects.toThrow();
  });
  it('refuses rebinding a detail after a journal line refers to it', async () => {
    const type = await db.accountingConfiguration.findFirstOrThrow({
      where: { bookId, kind: 'detail-types', title: 'پروژه' },
    });
    const detail = await act<AccountingDetailV1>('save-detail', {
      typeId: type.id,
      title: 'x',
      sourceConfigurationId: records.PROJECT!.id,
      attributes: {},
    });
    const journal = await db.accountingJournal.create({
      data: { bookId, makerId: actorId, attributes: {} },
    });
    await db.accountingJournalLine.create({
      data: {
        journalId: journal.id,
        position: 1,
        detail4Id: detail.id,
        attributes: {},
      },
    });
    const other = await act<AccountingDetailOwnerV1>('save-detail-owner', {
      ownerKind: 'PROJECT',
      code: '99',
      title: 'Other project',
      attributes: {},
    });
    await expect(
      act(
        'save-detail',
        {
          id: detail.id,
          typeId: type.id,
          code: detail.code,
          title: detail.title,
          sourceConfigurationId: other.id,
          attributes: {},
        },
        detail.version,
      ),
    ).rejects.toThrow();
  });
  it('generates distinct zero-padded detail codes on simultaneous creation', async () => {
    const type = await db.accountingConfiguration.findFirstOrThrow({
      where: { bookId, kind: 'detail-types', title: 'پروژه' },
    });
    const results = await Promise.all(
      Array.from({ length: 4 }, () =>
        act<AccountingDetailV1>('save-detail', {
          typeId: type.id,
          title: 'x',
          sourceConfigurationId: records.PROJECT!.id,
          attributes: {},
        }),
      ),
    );
    expect(new Set(results.map((d) => d.code)).size).toBe(4);
    expect(results.every((d) => /^0{6}[0-9]{2}$/.test(d.code))).toBe(true);
  });
  it('rejects a new detail bound to an inactive source', async () => {
    const row = await act<AccountingDetailOwnerV1>('save-detail-owner', {
      ownerKind: 'PROJECT',
      code: 'inactive',
      title: 'Inactive project',
      active: false,
      attributes: {},
    });
    const type = await db.accountingConfiguration.findFirstOrThrow({
      where: { bookId, kind: 'detail-types', title: 'پروژه' },
    });
    await expect(
      act('save-detail', {
        typeId: type.id,
        title: 'x',
        sourceConfigurationId: row.id,
        attributes: {},
      }),
    ).rejects.toThrow();
  });

  it('detects a concurrent change made through the native cashbox and reads its latest location', async () => {
    const id = records.CASH!.id,
      book = { id: bookId, branchId, baseCurrency: 'IRR' };
    const original = (
      await db.$transaction((tx) =>
        detailOwners(tx, book, { kind: 'CASH', id }),
      )
    ).rows[0]!;
    await db.financeSettlementAccount.update({
      where: { id },
      data: { version: { increment: 1 } },
    });
    await db.treasuryInstrument.update({
      where: { id },
      data: {
        location: 'Changed via native cashbox',
        titleEn: 'Native English title',
      },
    });
    const fresh = (
      await db.$transaction((tx) =>
        detailOwners(tx, book, { kind: 'CASH', id }),
      )
    ).rows[0]!;
    expect(fresh.attributes.location).toBe('Changed via native cashbox');
    expect(fresh.titleEn).toBe('Native English title');
    await expect(
      act(
        'save-detail-owner',
        {
          id,
          ownerKind: 'CASH',
          code: original.code,
          title: original.title,
          currency: 'IRR',
          attributes: { operatorId: personId },
        },
        original.version,
      ),
    ).rejects.toThrow();
  });
  it('keeps lookups in one book and bounds pagination', async () => {
    await db.accountingConfiguration.createMany({
      data: Array.from({ length: 34 }, (_, n) => ({
        bookId,
        kind: 'detail-owner-petty_cash',
        code: 'page-' + String(n).padStart(2, '0'),
        title: 'Pagination only ' + n,
        attributes: { currency: 'IRR' },
      })),
    });
    const book = { id: bookId, branchId, baseCurrency: 'IRR' };
    const first = await db.$transaction((tx) =>
      detailOwners(tx, book, {
        kind: 'PETTY_CASH',
        search: 'Pagination only',
        page: '1',
      }),
    );
    const second = await db.$transaction((tx) =>
      detailOwners(tx, book, {
        kind: 'PETTY_CASH',
        search: 'Pagination only',
        page: '2',
      }),
    );
    expect(first.rows).toHaveLength(30);
    expect(first.hasNext).toBe(true);
    expect(second.rows).toHaveLength(4);
    expect(second.hasNext).toBe(false);
    expect(new Set([...first.rows, ...second.rows].map((r) => r.id)).size).toBe(
      34,
    );

    expect(
      (
        await db.$transaction((tx) =>
          detailOwners(
            tx,
            { id: otherBookId, branchId, baseCurrency: 'IRR' },
            { kind: 'BRANCH' },
          ),
        )
      ).rows,
    ).toHaveLength(0);
    await expect(
      db.$transaction((tx) =>
        detailOwners(
          tx,
          { id: bookId, branchId, baseCurrency: 'IRR' },
          { kind: 'PROJECT', page: '0' },
        ),
      ),
    ).rejects.toThrow();
  });
});
