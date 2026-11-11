import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../../database/database.service';
import { AccountingCompanyScope } from './accounting-company-scope';
import { AccountingCompletionService } from './accounting-completion.service';

const bookId = '11111111-1111-4111-8111-111111111111';
const periodId = '22222222-2222-4222-8222-222222222222';
const accountId = '33333333-3333-4333-8333-333333333333';
const actor: AuthenticatedActor = {
  userId: accountId,
  sessionId: periodId,
  branchIds: [bookId],
  permissions: ['finance.read', 'finance.journal.read'],
};
function fixture(companyScope?: AccountingCompanyScope) {
  const account = {
    id: accountId,
    bookId,
    code: '10',
    title: 'Synthetic',
    nature: 'DEBIT',
    permanent: true,
  };
  const tx = {
    accountingBook: {
      findFirst: vi.fn(async () => ({ id: bookId, baseCurrency: 'IRR' })),
    },
    accountingPeriod: {
      findFirst: vi.fn(async () => ({
        id: periodId,
        bookId,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        status: 'OPEN',
      })),
    },
    accountingAccount: {
      findFirst: vi.fn(async () => account),
      findMany: vi.fn(async () => [account]),
    },
    accountingDetail: {
      findFirst: vi.fn(async () => ({ id: accountId, bookId })),
    },
    accountingJournal: { count: vi.fn(async () => 2) },
    accountingJournalLine: {
      count: vi.fn(async () => 73),
      aggregate: vi.fn(async () => ({
        _sum: {
          debit: new Prisma.Decimal('999999999999999999.123456789123456789'),
          credit: new Prisma.Decimal('0.000000000000000001'),
        },
      })),
      groupBy: vi.fn(async () => [
        {
          accountId,
          _sum: {
            debit: new Prisma.Decimal('0'),
            credit: new Prisma.Decimal('0.000000000000000001'),
          },
        },
      ]),
      findMany: vi.fn(async () => [
        {
          id: 'line',
          position: 1,
          description: '',
          debit: new Prisma.Decimal('1.000000000000000001'),
          credit: new Prisma.Decimal(0),
          currency: 'IRR',
          foreignAmount: null,
          rate: null,
          journal: {
            id: 'journal',
            number: 17,
            documentDate: '2026-02-01',
            description: 'Header',
          },
          account,
          detail4: null,
          detail5: null,
          detail6: null,
        },
      ]),
    },
  };
  const transaction = vi.fn(async (fn: (t: typeof tx) => unknown) => fn(tx));
  return {
    tx,
    transaction,
    service: new AccountingCompletionService(
      {
        client: { $transaction: transaction },
      } as unknown as DatabaseService,
      companyScope,
    ),
  };
}
describe('independent accounting completion reads', () => {
  it('rejects another company before journal reports, internal reports or year-end diagnostics read financial data', async () => {
    const companyScope = new AccountingCompanyScope({
      current: async () => ({
        data: { selection: 'NIYAYESH_SEIR_SAHAR', isAggregate: false },
      }),
      selectable: async () => ({
        data: [
          {
            id: accountId,
            code: 'NIYAYESH_SEIR_SAHAR',
            persianName: 'Synthetic company',
          },
        ],
      }),
    } as never);
    for (const kind of ['lines', 'internal', 'year-end', 'browser']) {
      const { service, tx } = fixture(companyScope);
      const result =
        kind === 'lines'
          ? service.journalLines(bookId, { periodId }, actor)
          : kind === 'internal'
            ? service.internalReport(bookId, 'analysis', { periodId }, actor)
            : kind === 'browser'
              ? service.journalBrowser(bookId, { periodId }, actor)
              : service.yearEndReadiness(bookId, periodId, actor);
      await expect(result).rejects.toThrow(
        'دفتر حسابداری در شرکت فعال در دسترس نیست.',
      );
      expect(tx.accountingPeriod.findFirst).not.toHaveBeenCalled();
      expect(tx.accountingJournalLine.findMany).not.toHaveBeenCalled();
    }
  });
  it('requires both permissions before reading any account data', async () => {
    for (const permissions of [
      [],
      ['finance.read'],
      ['finance.journal.read'],
    ] as AuthenticatedActor['permissions'][]) {
      const { service, tx } = fixture();
      await expect(
        service.journalLines(bookId, { periodId }, { ...actor, permissions }),
      ).rejects.toThrow();
      expect(tx.accountingBook.findFirst).not.toHaveBeenCalled();
    }
  });
  it('scopes the book by authorized branches and refuses a missing book', async () => {
    const { service, tx } = fixture();
    tx.accountingBook.findFirst.mockResolvedValueOnce(null as never);
    await expect(
      service.journalLines(bookId, { periodId }, actor),
    ).rejects.toThrow();
    expect(tx.accountingBook.findFirst).toHaveBeenCalledWith({
      where: { id: bookId, branchId: { in: actor.branchIds } },
    });
    expect(tx.accountingJournalLine.count).not.toHaveBeenCalled();
  });
  it('refuses unknown filters, arrays, invalid pages, absent periods and dates outside one fiscal period', async () => {
    for (const query of [
      {},
      { periodId, status: 'UNKNOWN' },
      { periodId, unsupported: 'value' },
      { periodId, amountMode: 'FOREIGN' },
      { periodId, currency: 'USD,EUR' },
      { periodId, fromNumber: '20', toNumber: '10' },
      { periodId, descriptionMode: 'sql' },
      { periodId: [periodId] },
      { periodId, page: '1.5' },
      { periodId, page: '0' },
      { periodId, page: '100000' },
      { periodId, from: '2025-12-31' },
      { periodId, from: '2026-05-01', to: '2026-04-01' },
      { periodId, to: '2026-02-30' },
    ]) {
      const { service, tx } = fixture();
      await expect(
        service.journalLines(bookId, query, actor),
      ).rejects.toThrow();
      expect(tx.accountingJournalLine.findMany).not.toHaveBeenCalled();
    }
  });
  it('keeps exact decimal strings, complete filtered totals, posted-only grain and stable pagination', async () => {
    const { service, tx, transaction } = fixture();
    const result = await service.journalLines(
      bookId,
      { periodId, page: '2', accountId },
      actor,
    );
    expect(result.debit).toBe('999999999999999999.123456789123456789');
    expect(result.credit).toBe('0.000000000000000001');
    expect(result.rows[0]?.debit).toBe('1.000000000000000001');
    expect(result.rows[0]?.description).toBe('Header');
    expect(result.total).toBe(73);
    const filter = {
      accountId,
      journal: {
        bookId,
        periodId: { in: [periodId] },
        status: 'POSTED',
        documentDate: { gte: '2026-01-01', lte: '2026-12-31' },
      },
    };
    expect(tx.accountingJournalLine.count).toHaveBeenCalledWith({
      where: filter,
    });
    expect(tx.accountingJournalLine.aggregate).toHaveBeenCalledWith({
      where: filter,
      _sum: { debit: true, credit: true },
    });
    expect(tx.accountingJournalLine.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: filter,
        skip: 50,
        take: 50,
        orderBy: [
          { journal: { documentDate: 'asc' } },
          { journalId: 'asc' },
          { position: 'asc' },
        ],
      }),
    );
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: 'RepeatableRead',
    });
  });
  it('rejects account/detail filters outside the selected book', async () => {
    for (const field of ['accountId', 'detail4Id', 'detail5Id', 'detail6Id']) {
      const { service, tx } = fixture();
      if (field === 'accountId')
        tx.accountingAccount.findFirst.mockResolvedValueOnce(null as never);
      else tx.accountingDetail.findFirst.mockResolvedValueOnce(null as never);
      await expect(
        service.journalLines(bookId, { periodId, [field]: accountId }, actor),
      ).rejects.toThrow();
      expect(tx.accountingJournalLine.count).not.toHaveBeenCalled();
    }
  });
  it('applies explicit status, numeric range and header description together without changing financial report defaults', async () => {
    const { service, tx } = fixture();
    const result = await service.journalLines(
      bookId,
      {
        periodId,
        status: 'ALL',
        fromNumber: '١٢',
        toNumber: '۲۰',
        description: 'Synthetic',
        descriptionMode: 'startsWith',
      },
      actor,
    );
    expect(result.basis).toBe('ALL');
    expect(tx.accountingJournalLine.count).toHaveBeenCalledWith({
      where: {
        journal: {
          bookId,
          periodId: { in: [periodId] },
          status: { not: 'CANCELLED' },
          documentDate: { gte: '2026-01-01', lte: '2026-12-31' },
          number: { gte: 12, lte: 20 },
          description: { startsWith: 'Synthetic', mode: 'insensitive' },
        },
      },
    });
  });
  it('never combines foreign amounts across currencies and sums each debit/credit side exactly', async () => {
    const { service, tx } = fixture();
    tx.accountingJournalLine.aggregate
      .mockResolvedValueOnce({
        _sum: {
          debit: new Prisma.Decimal(100),
          credit: new Prisma.Decimal(100),
        },
      })
      .mockResolvedValueOnce({
        _sum: { foreignAmount: new Prisma.Decimal('1.000000000000000001') },
      } as never)
      .mockResolvedValueOnce({
        _sum: { foreignAmount: new Prisma.Decimal('1.000000000000000001') },
      } as never);
    const result = await service.journalLines(
      bookId,
      { periodId, currency: 'USD', amountMode: 'FOREIGN' },
      actor,
    );
    expect(result).toMatchObject({
      currency: 'USD',
      amountMode: 'FOREIGN',
      debit: '1.000000000000000001',
      credit: '1.000000000000000001',
    });
    expect(tx.accountingJournalLine.aggregate).toHaveBeenNthCalledWith(2, {
      where: expect.objectContaining({
        currency: 'USD',
        foreignAmount: { not: null },
        debit: { gt: 0 },
      }),
      _sum: { foreignAmount: true },
    });
    expect(tx.accountingJournalLine.aggregate).toHaveBeenNthCalledWith(3, {
      where: expect.objectContaining({ currency: 'USD', credit: { gt: 0 } }),
      _sum: { foreignAmount: true },
    });
  });
  it('returns period-wide readiness without creating a document and detects sub-unit contrary balances', async () => {
    const { service, tx } = fixture();
    const result = await service.yearEndReadiness(bookId, periodId, actor);
    expect(result).toMatchObject({
      diagnosticOnly: true,
      executionAvailable: false,
      posted: 2,
      unfinished: 2,
    });
    expect(result.exceptions).toEqual([
      expect.objectContaining({
        balance: '-0.000000000000000001',
        contrary: true,
        temporary: false,
      }),
    ]);
    expect(tx.accountingJournal.count).toHaveBeenCalledWith({
      where: { bookId, periodId, status: { notIn: ['POSTED', 'CANCELLED'] } },
    });
    expect(tx.accountingJournalLine.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { journal: { bookId, periodId, status: 'POSTED' } },
      }),
    );
  });
});
