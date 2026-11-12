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
});
