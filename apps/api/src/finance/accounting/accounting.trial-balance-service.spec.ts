import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { AccountingService } from './accounting.service';

const bookId = '10000000-0000-4000-8000-000000000001';
const periodId = '10000000-0000-4000-8000-000000000002';
const actor = {
  permissions: ['finance.read', 'finance.journal.read'],
  branchIds: ['allowed'],
} as AuthenticatedActor;
function setup(visible = true) {
  const groupBy = vi
    .fn()
    .mockResolvedValueOnce([
      { accountId: 'a', _sum: { debit: '100', credit: '40' } },
      { accountId: 'b', _sum: { debit: '30', credit: '50' } },
    ])
    .mockResolvedValueOnce([
      { accountId: 'a', _sum: { debit: '5', credit: '15' } },
      { accountId: 'b', _sum: { debit: '8', credit: '2' } },
    ]);
  const tx = {
    accountingBook: {
      findFirst: vi.fn().mockResolvedValue(visible ? { id: bookId } : null),
    },
    accountingPeriod: {
      findFirst: vi.fn().mockResolvedValue({
        id: periodId,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      }),
    },
    accountingAccount: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'group',
          code: '1',
          title: 'Group',
          level: 'GROUP',
          parentId: null,
        },
        {
          id: 'general',
          code: '11',
          title: 'General',
          level: 'GENERAL',
          parentId: 'group',
        },
        {
          id: 'a',
          code: '111',
          title: 'A',
          level: 'SUBSIDIARY',
          parentId: 'general',
        },
        {
          id: 'b',
          code: '112',
          title: 'B',
          level: 'SUBSIDIARY',
          parentId: 'general',
        },
      ]),
    },
    accountingJournalLine: { groupBy },
  };
  const database = {
    client: {
      $transaction: (operation: (client: typeof tx) => unknown) =>
        operation(tx),
    },
  };
  const service = new AccountingService(database as never, {} as never);
  return { service, tx, groupBy };
}
describe('trial balance gross opening aggregation', () => {
  it('rolls each child into its parent once while retaining the old net opening', async () => {
    const { service, tx, groupBy } = setup();
    const report = await service.report(
      bookId,
      {
        periodId,
        from: '2026-02-01',
        to: '2026-02-28',
        level: 'GROUP',
        structure: '8',
      },
      actor,
    );
    expect(report.rows).toEqual([
      expect.objectContaining({
        accountId: 'group',
        opening: '40',
        priorDebit: '130',
        priorCredit: '90',
        debit: '13',
        credit: '17',
        balance: '36',
      }),
    ]);
    expect(report.table.rows[0]!.values.slice(2)).toEqual([
      '130',
      '90',
      '13',
      '17',
      '143',
      '107',
      '36',
      '0',
    ]);
    expect(tx.accountingBook.findFirst).toHaveBeenCalledWith({
      where: { id: bookId, branchId: { in: ['allowed'] } },
    });
    expect(groupBy.mock.calls[0]![0].where.journal).toEqual({
      bookId,
      periodId,
      status: 'POSTED',
      documentDate: { lt: '2026-02-01' },
    });
    expect(groupBy.mock.calls[1]![0].where.journal.documentDate).toEqual({
      gte: '2026-02-01',
      lte: '2026-02-28',
    });
  });
  it('does not read aggregates when the book is outside the actor scope', async () => {
    const { service, groupBy } = setup(false);
    await expect(service.report(bookId, { periodId }, actor)).rejects.toThrow();
    expect(groupBy).not.toHaveBeenCalled();
  });
});
