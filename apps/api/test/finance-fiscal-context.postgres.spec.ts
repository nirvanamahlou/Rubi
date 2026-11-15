import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient, type DatabaseClient } from '@nora/database';
import type {
  AuthenticatedActor,
  FinanceFiscalRequestV1,
} from '@nora/contracts';
import {
  accountingTestUrl,
  assertAccountingTestDatabase,
} from './accounting-test-database';
import { AccountingService } from '../src/finance/accounting/accounting.service';
import { AccountingCompanyScope } from '../src/finance/accounting/accounting-company-scope';
import { FinanceFiscalContextService } from '../src/finance/fiscal-context/finance-fiscal-context.service';
import {
  FinanceFiscalStorage,
  assertFinanceFiscalWrite,
} from '../src/finance/fiscal-context/finance-fiscal-storage';
import { recordFinancialEvent } from '../src/finance/accounting/financial-event.public';
import { FinancePayrollService } from '../src/finance/operations/finance-payroll.service';
import { AccountingCompletionService } from '../src/finance/accounting/accounting-completion.service';
import { AccountingTaxService } from '../src/finance/accounting/accounting-tax.service';
import { AccountingTaxpayerService } from '../src/finance/accounting/accounting-taxpayer.service';

const url = accountingTestUrl('ACCOUNTING_TEST_DATABASE_URL');
describe.skipIf(!url)('Finance fiscal context on isolated PostgreSQL', () => {
  let db: DatabaseClient,
    accounting: AccountingService,
    context: FinanceFiscalContextService;
  const storage = new FinanceFiscalStorage();
  const branchId = randomUUID(),
    userId = randomUUID(),
    entityId = randomUUID(),
    bookId = randomUUID();
  const actor: AuthenticatedActor = {
    userId,
    sessionId: randomUUID(),
    branchIds: [branchId],
    permissions: [
      'finance.read',
      'finance.account.manage',
      'finance.journal.read',
      'finance.journal.create',
    ],
  };
  const code = 'FT_' + entityId.slice(0, 8);
  const scope = new AccountingCompanyScope({
    current: async () => ({
      data: {
        selection: code,
        isAggregate: false,
        legalEntity: { id: entityId },
      },
    }),
    selectable: async () => ({
      data: [{ id: entityId, code, persianName: 'Synthetic Fiscal Company' }],
    }),
  } as never);
  const command = (
    action: string,
    payload: Record<string, unknown>,
    expectedVersion?: number,
    key = randomUUID(),
    principal = actor,
  ) =>
    accounting.command(
      bookId,
      action,
      { payload, expectedVersion, key },
      principal,
    );
  let periods: { id: string; version: number }[];
  beforeAll(async () => {
    assertAccountingTestDatabase(url!, '55437', 'accounting_test');
    db = createDatabaseClient(url);
    await db.branch.create({
      data: { id: branchId, code: branchId, name: 'Synthetic fiscal test' },
    });
    await db.user.create({
      data: {
        id: userId,
        username: userId,
        displayName: 'Synthetic fiscal actor',
        passwordHash: 'not-a-login-credential',
      },
    });
    await db.legalEntity.create({
      data: { id: entityId, code, persianName: 'Synthetic Fiscal Company' },
    });
    await db.accountingBook.create({
      data: {
        id: bookId,
        branchId,
        legalEntityId: entityId,
        code: '001',
        title: 'Synthetic Fiscal Company',
        baseCurrency: 'IRR',
      },
    });
    accounting = new AccountingService(
      { client: db } as never,
      { displayNames: async () => [] } as never,
      undefined,
      undefined,
      undefined,
      scope,
      storage,
    );
    context = new FinanceFiscalContextService({ client: db } as never, scope);
    periods = [];
    for (const [year, startDate, endDate] of [
      ['1404', '2025-03-21', '2026-03-20'],
      ['1405', '2026-03-21', '2027-03-20'],
    ])
      periods.push(
        (await command('save-period', {
          fiscalYearCode: year,
          startDate,
          endDate,
        })) as (typeof periods)[number],
      );
  }, 30000);
  afterAll(async () => {
    await db?.$disconnect();
  });
  it('does not choose a year implicitly and retains persisted default across users and sessions', async () => {
    expect((await context.current(actor)).defaultPeriodId).toBeNull();
    const book = await db.accountingBook.findUniqueOrThrow({
      where: { id: bookId },
    });
    const key = randomUUID();
    const saved = await command(
      'set-default-period',
      { id: periods[1]!.id, isDefault: true },
      book.version,
      key,
    );
    expect(saved).toMatchObject({ id: periods[1]!.id, isDefault: true });
    expect(
      await command(
        'set-default-period',
        { id: periods[1]!.id, isDefault: true },
        book.version,
        key,
      ),
    ).toMatchObject({ id: periods[1]!.id });
    expect(
      (
        await context.current({
          ...actor,
          sessionId: randomUUID(),
          userId: randomUUID(),
        })
      ).defaultPeriodId,
    ).toBe(periods[1]!.id);
    await expect(
      command(
        'set-default-period',
        { id: periods[0]!.id, isDefault: true },
        book.version,
      ),
    ).rejects.toThrow();
    await expect(
      command(
        'set-default-period',
        { id: periods[0]!.id, isDefault: true },
        undefined,
        randomUUID(),
        { ...actor, permissions: ['finance.read', 'finance.journal.read'] },
      ),
    ).rejects.toThrow();
  });
  it('enforces one default in the database and serializes simultaneous default changes with CAS', async () => {
    await expect(
      db.accountingPeriod.update({
        where: { id: periods[0]!.id },
        data: { isDefault: true },
      }),
    ).rejects.toThrow();
    const book = await db.accountingBook.findUniqueOrThrow({
      where: { id: bookId },
    });
    const outcomes = await Promise.allSettled(
      [periods[0]!, periods[1]!].map((period) =>
        command(
          'set-default-period',
          { id: period.id, isDefault: true },
          book.version,
        ),
      ),
    );
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      await db.accountingPeriod.count({ where: { bookId, isDefault: true } }),
    ).toBe(1);
  });
  const current = async (): Promise<FinanceFiscalRequestV1> =>
    context.resolve(actor, { mode: 'temporary', periodId: periods[1]!.id });
  it('filters journal reads at the source and rejects cross-year IDs and dates before changing records', async () => {
    for (const period of periods)
      await db.accountingJournal.create({
        data: {
          bookId,
          periodId: period.id,
          makerId: userId,
          attributes: {},
          status: 'DRAFT',
          documentDate:
            period.id === periods[0]!.id ? '2025-10-01' : '2026-10-01',
        },
      });
    const selected = await current();
    await storage.run(selected, async () => {
      const page = await accounting.journals(bookId, {}, actor);
      expect(page.items).toHaveLength(1);
      expect(page.items[0]!.periodId).toBe(selected.period!.id);
      await expect(
        accounting.journals(bookId, { periodId: periods[0]!.id }, actor),
      ).rejects.toThrow();
      const old = await db.accountingJournal.findFirstOrThrow({
        where: { bookId, periodId: periods[0]!.id },
      });
      await expect(
        command('cancel', { id: old.id }, old.version),
      ).rejects.toThrow();
      await expect(
        command('journal-memorandum-save', {
          documentDate: '2025-10-01',
          lines: [],
        }),
      ).rejects.toThrow();
    });
    expect(
      await db.accountingJournal.count({ where: { bookId, status: 'DRAFT' } }),
    ).toBe(2);
  });
  it('binds new money facts to the selected year without modifying their immutable fingerprint or legacy facts', async () => {
    const selected = await current();
    const input = {
      source: 'OPERATIONAL' as const,
      kind: 'CHECK_APPROVED',
      recordId: randomUUID(),
      requestId: randomUUID(),
      branchId,
      actorId: userId,
      amount: '10.125',
      currency: 'IRR',
      occurredAt: new Date('2026-11-15T08:00:00Z'),
    };
    const id = await storage.run(selected, () =>
      db.$transaction((tx) => recordFinancialEvent(tx, input)),
    );
    const saved = await db.financeAccountingEvent.findUniqueOrThrow({
      where: { id },
    });
    expect(saved.fiscalPeriodId).toBe(selected.period!.id);
    expect(await db.$transaction((tx) => recordFinancialEvent(tx, input))).toBe(
      id,
    );
    expect(
      (await db.financeAccountingEvent.findUniqueOrThrow({ where: { id } }))
        .fingerprint,
    ).toBe(saved.fingerprint);
    const legacyId = await db.$transaction((tx) =>
      recordFinancialEvent(tx, { ...input, recordId: randomUUID() }),
    );
    expect(
      (
        await db.financeAccountingEvent.findUniqueOrThrow({
          where: { id: legacyId },
        })
      ).fiscalPeriodId,
    ).toBeNull();
    await storage.run(selected, () =>
      expect(
        db.$transaction((tx) =>
          recordFinancialEvent(tx, {
            ...input,
            recordId: randomUUID(),
            occurredAt: new Date('2025-01-01'),
          }),
        ),
      ).rejects.toThrow(),
    );
    expect(await db.financeAccountingEvent.count({ where: { branchId } })).toBe(
      2,
    );
    await expect(
      db.accountingPeriod.delete({ where: { id: selected.period!.id } }),
    ).rejects.toThrow();
  });
  it('filters tax periods and cancellation drafts before paging and guards old-year deletion', async () => {
    const tax = new AccountingTaxService({ client: db } as never, {} as never);
    const taxpayer = new AccountingTaxpayerService({ client: db } as never);
    const rows: { period: string; cancellation: string }[] = [];
    for (const date of ['2025-10-01', '2026-10-01']) {
      const period = await db.accountingConfiguration.create({
        data: {
          bookId,
          kind: 'vat-periods',
          code: randomUUID(),
          title: 'Synthetic tax period',
          attributes: {
            dpkStartDate_MaskedTextBox: date,
            dpkEndDate_MaskedTextBox: date,
          },
        },
      });
      const cancellation = await db.accountingConfiguration.create({
        data: {
          bookId,
          kind: 'taxpayer-draft-cancellations',
          code: randomUUID(),
          title: 'Synthetic cancellation',
          attributes: {
            dpCancellationDate_MaskedTextBox: date,
            txtUniqueBillNumberRef: `synthetic-${date}`,
            lkpReferenceActionType_ComboBox_Input: 'اصلی',
            dpReferenceDate_MaskedTextBox: date,
          },
        },
      });
      rows.push({ period: period.id, cancellation: cancellation.id });
    }
    await storage.run(await current(), async () => {
      expect(
        (await tax.list(bookId, 'periods', actor)).items.map((row) => row.id),
      ).toEqual([rows[1]!.period]);
      const drafts = await taxpayer.drafts(bookId, 'cancellations', {}, actor);
      expect(drafts.total).toBe(1);
      expect(drafts.items[0]?.id).toBe(rows[1]!.cancellation);
      await expect(
        tax.remove(
          bookId,
          'periods',
          rows[0]!.period,
          { version: 1, key: randomUUID() },
          actor,
        ),
      ).rejects.toThrow();
    });
    expect(
      await db.accountingConfiguration.count({
        where: { bookId, kind: 'vat-periods' },
      }),
    ).toBe(2);
  });
  it('applies the same source-year guard to completion reports and browsing', async () => {
    const completion = new AccountingCompletionService(
      { client: db } as never,
      scope,
      undefined,
      storage,
    );
    await storage.run(await current(), async () => {
      await expect(
        completion.journalLines(bookId, { periodId: periods[0]!.id }, actor),
      ).rejects.toThrow();
      await expect(
        completion.journalBrowser(bookId, { periodId: periods[0]!.id }, actor),
      ).rejects.toThrow();
      await expect(
        accounting.report(bookId, { periodId: periods[0]!.id }, actor),
      ).rejects.toThrow();
      await expect(
        accounting.analyticalReport(
          bookId,
          'comparative',
          { leftPeriodId: periods[0]!.id },
          actor,
        ),
      ).rejects.toThrow();
    });
  });
  it('anchors new Finance requests to their origin year/company while keeping cross-year settlement possible', async () => {
    const service = new FinancePayrollService(
      { client: db } as never,
      {} as never,
      undefined,
      undefined,
      { assertCurrency: async () => undefined } as never,
    );
    const selected = await current();
    const id = randomUUID();
    await storage.run(selected, () =>
      service.createManual(
        {
          operationId: id,
          branchId,
          kind: 'CHECK',
          title: 'Synthetic check',
          party: 'Synthetic party',
          description: '',
          reference: 'Synthetic check ref',
          amount: '10.125',
          currencyCode: 'IRR',
          dueAt: '2026-12-01',
        },
        {
          ...actor,
          permissions: [...actor.permissions, 'finance.request.manage'],
        },
      ),
    );
    expect(
      await db.financeOperationalRequest.findUnique({ where: { id } }),
    ).toMatchObject({
      fiscalPeriodId: selected.period!.id,
      amount: expect.anything(),
    });
    await storage.run({ ...selected, bookId: randomUUID() }, () =>
      expect(service.detail(id, actor)).rejects.toThrow(),
    );
    await storage.run(selected, () =>
      expect(service.detail(id, actor)).resolves.toMatchObject({
        id,
        amount: '10.125',
      }),
    );
  });
  it('rejects stale calendar versions inside the write transaction and preserves empty defaults', async () => {
    const selected = await current();
    await db.accountingPeriod.update({
      where: { id: selected.period!.id },
      data: { version: { increment: 1 } },
    });
    await storage.run(selected, () =>
      expect(
        db.$transaction((tx) => assertFinanceFiscalWrite(tx, '2026-11-15')),
      ).rejects.toThrow(),
    );
    const book = await db.accountingBook.findUniqueOrThrow({
      where: { id: bookId },
    });
    const active = await db.accountingPeriod.findFirstOrThrow({
      where: { bookId, isDefault: true },
    });
    await command(
      'set-default-period',
      { id: active.id, isDefault: false },
      book.version,
    );
    expect((await context.resolve(actor, {})).period).toBeNull();
    expect(await db.accountingPeriod.count({ where: { bookId } })).toBe(2);
  });
});
