import {
  accountingTestUrl,
  assertAccountingTestDatabase,
} from './accounting-test-database';
import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { AccountingService } from '../src/finance/accounting/accounting.service';
import { AccountingCompanyScope } from '../src/finance/accounting/accounting-company-scope';
import { AccountingCompletionService } from '../src/finance/accounting/accounting-completion.service';

const url = accountingTestUrl('ACCOUNTING_TEST_DATABASE_URL');
describe.skipIf(!url)('company ledgers on isolated PostgreSQL', () => {
  let db: DatabaseClient, service: AccountingService;
  const branchId = randomUUID(),
    userId = randomUUID();
  const companyA = {
    id: randomUUID(),
    code: 'TEST_A_' + randomUUID().slice(0, 8),
    title: 'شرکت آزمایشی اول',
  };
  const companyB = {
    id: randomUUID(),
    code: 'TEST_B_' + randomUUID().slice(0, 8),
    title: 'شرکت آزمایشی دوم',
  };
  let selection = companyA.code;
  const actor: AuthenticatedActor = {
    userId,
    sessionId: randomUUID(),
    branchIds: [branchId],
    permissions: [
      'finance.read',
      'finance.journal.read',
      'finance.account.manage',
      'legal-entity.aggregate.read',
    ],
  };
  const scope = new AccountingCompanyScope({
    current: async () => ({
      data: { selection, isAggregate: selection === 'ALL' },
    }),
    selectable: async () => ({
      data: [companyA, companyB].map((c) => ({ ...c, persianName: c.title })),
    }),
  } as never);
  const create = (id = randomUUID()) =>
    service.createBook(
      {
        id,
        legalEntityId: companyA.id,
        code: '001',
        title: 'عنوان جعلی',
        approvalPolicy: 'DUAL_CONTROL',
      },
      actor,
    );
  const command = (
    bookId: string,
    action: string,
    payload: Record<string, unknown>,
    expectedVersion?: number,
    key = randomUUID(),
  ) =>
    service.command(bookId, action, { key, payload, expectedVersion }, actor);
  beforeAll(async () => {
    assertAccountingTestDatabase(url!, '55437', 'accounting_test');
    db = createDatabaseClient(url);
    await db.branch.create({
      data: { id: branchId, code: branchId, name: 'Synthetic company test' },
    });
    await db.user.create({
      data: {
        id: userId,
        username: userId,
        displayName: 'Synthetic',
        passwordHash: 'not-a-login-credential',
      },
    });
    for (const c of [companyA, companyB])
      await db.legalEntity.create({
        data: { id: c.id, code: c.code, persianName: c.title },
      });
    service = new AccountingService(
      { client: db } as never,
      {
        branches: async () => [{ id: branchId }],
        displayNames: async () => [{ id: userId, displayName: 'Synthetic' }],
      } as never,
      undefined,
      undefined,
      undefined,
      scope,
    );
  });
  afterAll(async () => {
    await db?.$disconnect();
  });
  it('forces canonical title, preserves metadata and serializes concurrent company creation', async () => {
    const id = randomUUID();
    const [book, replay] = await Promise.all([create(id), create(id)]);
    expect(replay.id).toBe(id);
    expect(book).toMatchObject({
      title: companyA.title,
      legalEntityId: companyA.id,
      baseCurrency: 'IRR',
      branchId,
    });
    expect((await create(id)).id).toBe(id);
    const results = await Promise.allSettled([create(), create()]);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    expect(
      await db.accountingBook.count({ where: { legalEntityId: companyA.id } }),
    ).toBe(1);
    await command(
      id,
      'save-book',
      {
        legalEntityId: companyA.id,
        title: 'عنوان غیرمجاز',
        titleEn: 'Second title',
        description: 'Metadata',
        active: true,
        allowsPosting: true,
      },
      book.version,
    );
    expect(await db.accountingBook.findUnique({ where: { id } })).toMatchObject(
      {
        title: companyA.title,
        titleEn: 'Second title',
        description: 'Metadata',
      },
    );
  });
  it('isolates reads and commands, rejects stale company and aggregate writes', async () => {
    const book = await db.accountingBook.findUniqueOrThrow({
      where: { legalEntityId: companyA.id },
    });
    selection = companyB.code;
    expect((await service.books(actor)).books).toEqual([]);
    await expect(service.snapshot(book.id, actor)).rejects.toThrow();
    await expect(
      command(
        book.id,
        'save-book',
        { legalEntityId: companyA.id, title: companyA.title },
        book.version,
      ),
    ).rejects.toThrow();
    await expect(create()).rejects.toThrow();
    selection = 'ALL';
    expect((await service.books(actor)).books.map((b) => b.id)).toContain(
      book.id,
    );
    await expect(
      command(
        book.id,
        'save-book',
        { legalEntityId: companyA.id },
        book.version,
      ),
    ).rejects.toThrow();
    selection = companyA.code;
  });
  it('creates fiscal year and allocation atomically, supports replay, rejects overlap and stale edits', async () => {
    const book = await db.accountingBook.findUniqueOrThrow({
      where: { legalEntityId: companyA.id },
    });
    const payload = {
      fiscalYearCode: '1405',
      fiscalYearTitle: 'سال مالی ۱۴۰۵',
      startDate: '2026-03-21',
      endDate: '2027-03-20',
    };
    const key = randomUUID();
    const row = (await command(
      book.id,
      'save-period',
      payload,
      undefined,
      key,
    )) as { id: string; fiscalYearId: string; version: number };
    expect(
      await command(book.id, 'save-period', payload, undefined, key),
    ).toMatchObject({ id: row.id });
    await expect(
      command(book.id, 'save-period', {
        ...payload,
        fiscalYearCode: '1406',
        fiscalYearTitle: 'Overlap',
      }),
    ).rejects.toThrow();
    expect(
      await db.accountingConfiguration.count({
        where: { bookId: book.id, kind: 'fiscal-years', code: '1406' },
      }),
    ).toBe(0);
    await expect(
      command(
        book.id,
        'save-period',
        { ...payload, id: row.id, fiscalYearId: row.fiscalYearId },
        row.version + 1,
      ),
    ).rejects.toThrow();
    await db.accountingPeriod.update({
      where: { id: row.id },
      data: { status: 'CLOSED' },
    });
    await expect(
      command(
        book.id,
        'save-period',
        { ...payload, id: row.id, fiscalYearId: row.fiscalYearId },
        row.version,
      ),
    ).rejects.toThrow();
  });
  it('protects report and year-end read endpoints with the same live company context', async () => {
    const book = await db.accountingBook.findUniqueOrThrow({
      where: { legalEntityId: companyA.id },
    });
    const period = await db.accountingPeriod.findFirstOrThrow({
      where: { bookId: book.id },
    });
    const reports = new AccountingCompletionService(
      { client: db } as never,
      scope,
    );
    selection = companyB.code;
    for (const run of [
      () => reports.journalLines(book.id, { periodId: period.id }, actor),
      () => reports.journalBrowser(book.id, { periodId: period.id }, actor),
      () =>
        reports.internalReport(
          book.id,
          'analysis',
          { periodId: period.id },
          actor,
        ),
      () => reports.yearEndReadiness(book.id, period.id, actor),
      () => service.analyticalReport(book.id, 'standard-mapping', {}, actor),
      () => service.analyticalReport(book.id, 'standard-turnover', {}, actor),
    ]) {
      await expect(run()).rejects.toThrow(
        'دفتر حسابداری در شرکت فعال در دسترس نیست.',
      );
    }
    selection = companyA.code;
    expect(
      (await reports.journalLines(book.id, { periodId: period.id }, actor))
        .total,
    ).toBe(0);
    selection = 'ALL';
    expect(
      (await reports.journalBrowser(book.id, { periodId: period.id }, actor))
        .rows,
    ).toEqual([]);
    await expect(
      reports.journalLines(
        book.id,
        { periodId: period.id },
        {
          ...actor,
          permissions: actor.permissions.filter(
            (permission) => permission !== 'legal-entity.aggregate.read',
          ),
        },
      ),
    ).rejects.toThrow();
    selection = companyA.code;
  });
  it('preserves legacy ledger IDs and currency and only binds them explicitly', async () => {
    const legacy = await db.accountingBook.create({
      data: {
        branchId,
        code: 'LEGACY',
        title: 'Old book',
        baseCurrency: 'USD',
      },
    });
    selection = companyB.code;
    expect(
      (await service.books(actor)).unassignedBooks?.map((b) => b.id),
    ).toContain(legacy.id);
    expect((await service.books(actor)).books).toEqual([]);
    await expect(command(legacy.id, 'save-period', {})).rejects.toThrow();
    await command(
      legacy.id,
      'save-book',
      {
        legalEntityId: companyB.id,
        title: 'Manual title',
        active: true,
        allowsPosting: true,
      },
      legacy.version,
    );
    expect(
      await db.accountingBook.findUnique({ where: { id: legacy.id } }),
    ).toMatchObject({
      legalEntityId: companyB.id,
      title: companyB.title,
      baseCurrency: 'USD',
    });
    selection = companyA.code;
    await expect(service.snapshot(legacy.id, actor)).rejects.toThrow();
  });
  it('accepts direct numeric years, preserves existing titles and rolls back invalid allocations', async () => {
    const book = await db.accountingBook.findUniqueOrThrow({
      where: { legalEntityId: companyA.id },
    });
    const known = await db.accountingConfiguration.create({
      data: {
        bookId: book.id,
        kind: 'fiscal-years',
        code: '2030',
        title: 'Existing year title',
        attributes: {},
      },
    });
    const row = (await command(book.id, 'save-period', {
      fiscalYearCode: '۲۰۳۰',
      startDate: '2030-01-01',
      endDate: '2030-12-31',
    })) as { id: string; fiscalYearId: string; version: number };
    expect(row.fiscalYearId).toBe(known.id);
    expect(
      (
        await db.accountingConfiguration.findUniqueOrThrow({
          where: { id: known.id },
        })
      ).title,
    ).toBe('Existing year title');
    const next = (await command(book.id, 'save-period', {
      fiscalYearCode: '٢٠٣١',
      startDate: '2031-01-01',
      endDate: '2031-12-31',
    })) as { id: string; fiscalYearId: string; version: number };
    expect(
      await db.accountingConfiguration.findUniqueOrThrow({
        where: { id: next.fiscalYearId },
      }),
    ).toMatchObject({ code: '2031', title: '2031' });
    await expect(
      command(book.id, 'save-period', {
        fiscalYearCode: '2032',
        startDate: '2032-12-31',
        endDate: '2032-01-01',
      }),
    ).rejects.toThrow();
    expect(
      await db.accountingConfiguration.count({
        where: { bookId: book.id, kind: 'fiscal-years', code: '2032' },
      }),
    ).toBe(0);
    await expect(
      command(book.id, 'save-period', {
        fiscalYearCode: '2031',
        startDate: '2033-01-01',
        endDate: '2033-12-31',
      }),
    ).rejects.toThrow();
    await command(
      book.id,
      'save-period',
      {
        id: next.id,
        fiscalYearCode: '2033',
        startDate: '2033-01-01',
        endDate: '2033-12-31',
      },
      next.version,
    );
    expect(
      await db.accountingConfiguration.findUniqueOrThrow({
        where: { id: next.fiscalYearId },
      }),
    ).toMatchObject({ code: '2031', title: '2031' });
  });
  it('removes only an unused allocation with company/permission/CAS/replay guards and prevents stale resurrection', async () => {
    const book = await db.accountingBook.findUniqueOrThrow({
      where: { legalEntityId: companyA.id },
    });
    const row = (await command(book.id, 'save-period', {
      fiscalYearCode: '2034',
      startDate: '2034-01-01',
      endDate: '2034-12-31',
    })) as { id: string; fiscalYearId: string; version: number };
    await expect(
      command(book.id, 'delete-period', { id: row.id }, row.version + 1),
    ).rejects.toThrow();
    selection = companyB.code;
    await expect(
      command(book.id, 'delete-period', { id: row.id }, row.version),
    ).rejects.toThrow();
    selection = 'ALL';
    await expect(
      command(book.id, 'delete-period', { id: row.id }, row.version),
    ).rejects.toThrow();
    selection = companyA.code;
    await expect(
      service.command(
        book.id,
        'delete-period',
        {
          key: randomUUID(),
          payload: { id: row.id },
          expectedVersion: row.version,
        },
        { ...actor, permissions: ['finance.read', 'finance.journal.read'] },
      ),
    ).rejects.toThrow();
    expect(
      await db.accountingPeriod.findUnique({ where: { id: row.id } }),
    ).not.toBeNull();
    const key = randomUUID();
    const deleted = await command(
      book.id,
      'delete-period',
      { id: row.id },
      row.version,
      key,
    );
    expect(deleted).toMatchObject({
      id: row.id,
      fiscalYearId: row.fiscalYearId,
      deleted: true,
    });
    expect(
      await command(book.id, 'delete-period', { id: row.id }, row.version, key),
    ).toEqual(deleted);
    expect(
      await db.accountingPeriod.findUnique({ where: { id: row.id } }),
    ).toBeNull();
    expect(
      await db.accountingConfiguration.findUnique({
        where: { id: row.fiscalYearId },
      }),
    ).not.toBeNull();
    expect(
      await db.accountingCommand.count({
        where: { bookId: book.id, action: 'delete-period', key },
      }),
    ).toBe(1);
    await expect(
      command(
        book.id,
        'save-period',
        {
          id: row.id,
          fiscalYearCode: '2035',
          startDate: '2035-01-01',
          endDate: '2035-12-31',
        },
        row.version,
      ),
    ).rejects.toThrow();
    expect(
      await db.accountingConfiguration.count({
        where: { bookId: book.id, kind: 'fiscal-years', code: '2035' },
      }),
    ).toBe(0);
    const reused = (await command(book.id, 'save-period', {
      fiscalYearCode: '2034',
      startDate: '2034-01-01',
      endDate: '2034-12-31',
    })) as { id: string; version: number };
    expect(reused.id).not.toBe(row.id);
    const races = await Promise.allSettled([
      command(book.id, 'delete-period', { id: reused.id }, reused.version),
      command(book.id, 'delete-period', { id: reused.id }, reused.version),
    ]);
    expect(
      races.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(races.filter((result) => result.status === 'rejected')).toHaveLength(
      1,
    );
  });
  it('preserves closed, cancelled-journal, moved-journal-history and general-document allocations', async () => {
    const book = await db.accountingBook.findUniqueOrThrow({
      where: { legalEntityId: companyA.id },
    });
    const allocate = async (year: string) =>
      (await command(book.id, 'save-period', {
        fiscalYearCode: year,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      })) as { id: string; version: number };
    const history = await allocate('2037'),
      used = await allocate('2038'),
      closed = await allocate('2039'),
      general = await allocate('2040');
    await db.accountingPeriod.update({
      where: { id: closed.id },
      data: { status: 'CLOSED' },
    });
    const type = await db.accountingConfiguration.create({
      data: {
        bookId: book.id,
        kind: 'voucher-types',
        code: randomUUID(),
        title: 'Synthetic allocation evidence',
        attributes: {},
      },
    });
    const journal = await db.accountingJournal.create({
      data: {
        bookId: book.id,
        periodId: used.id,
        typeId: type.id,
        makerId: userId,
        status: 'CANCELLED',
        description: 'Synthetic retained journal',
        attributes: {},
      },
    });
    const evidence = await db.accountingCommand.create({
      data: {
        bookId: book.id,
        actorId: userId,
        action: 'synthetic-move-evidence',
        key: randomUUID(),
        hash: '0'.repeat(64),
        result: {},
      },
    });
    await db.accountingJournalStateEvent.create({
      data: {
        bookId: book.id,
        journalId: journal.id,
        commandId: evidence.id,
        actorId: userId,
        sequence: 1,
        eventType: 'MOVE',
        journalVersion: 1,
        oldPeriodId: history.id,
        newPeriodId: used.id,
      },
    });
    await db.accountingGeneralDocument.create({
      data: {
        bookId: book.id,
        periodId: general.id,
        number: 1,
        documentDate: '2040-01-01',
        method: 'NONE',
        makerId: userId,
      },
    });
    for (const period of [history, used, closed, general]) {
      await expect(
        command(book.id, 'delete-period', { id: period.id }, period.version),
      ).rejects.toThrow(
        'فقط تخصیص سال مالی باز و بدون سابقه مالی قابل حذف است.',
      );
      expect(
        await db.accountingPeriod.findUnique({ where: { id: period.id } }),
      ).not.toBeNull();
    }
    await expect(
      command(
        book.id,
        'save-period',
        {
          id: history.id,
          fiscalYearCode: '2037',
          startDate: '2037-02-01',
          endDate: '2037-12-31',
        },
        history.version,
      ),
    ).rejects.toThrow();
    expect(
      await db.accountingJournalStateEvent.count({
        where: { bookId: book.id, oldPeriodId: history.id },
      }),
    ).toBe(1);
  });
});
