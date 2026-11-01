import { describe, expect, it, vi } from 'vitest';
import {
  numberJournalPreview,
  reorderJournals,
  validateTemplateAssignments,
} from './accounting.documents';

const bookId = '10000000-0000-4000-8000-000000000001';
const first = '10000000-0000-4000-8000-000000000002';
const second = '10000000-0000-4000-8000-000000000003';
const periodId = '10000000-0000-4000-8000-000000000004';
const fixture = () => {
  const rows = [first, second].map((id, index) => ({
    id,
    bookId,
    periodId,
    documentDate: '2026-01-02',
    status: 'APPROVED',
    version: 2,
    number: 10 + index,
    attributes: { auxiliaryNumber: 'keep', dailyNumber: String(index + 1) },
  }));
  const update = vi.fn().mockResolvedValue({});
  const tx = {
    accountingJournal: { findMany: vi.fn().mockResolvedValue(rows), update },
    accountingPeriod: {
      findFirst: vi.fn().mockResolvedValue({ id: periodId }),
    },
  };
  const payload = {
    documentDate: '2026-01-02',
    items: [
      { id: second, expectedVersion: 2 },
      { id: first, expectedVersion: 2 },
    ],
  };
  return { rows, update, tx, payload };
};

describe('filtered numbering selection', () => {
  const numbering = () => {
    const base = fixture();
    const tx = {
      ...base.tx,
      accountingJournal: {
        ...base.tx.accountingJournal,
        findMany: vi.fn().mockResolvedValue([base.rows[0]]),
        aggregate: vi.fn().mockResolvedValue({ _max: { number: 42 } }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      accountingBook: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ nextNumber: 50 }),
        update: vi.fn().mockResolvedValue({}),
      },
    };
    const payload = {
      periodId,
      selectedOnly: true,
      items: [{ id: first, expectedVersion: 2 }],
    };
    return { tx, payload };
  };
  it('scopes selection to this book, open period and editable statuses, retaining other numbers', async () => {
    const { tx, payload } = numbering();
    const result = await numberJournalPreview(tx as never, bookId, payload);
    expect(tx.accountingJournal.findMany).toHaveBeenCalledWith({
      where: {
        bookId,
        periodId,
        status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'] },
        id: { in: [first] },
      },
      take: 501,
    });
    expect(tx.accountingJournal.updateMany).toHaveBeenCalledWith({
      where: { bookId, id: { in: [first] } },
      data: { number: null },
    });
    expect(tx.accountingJournal.update).toHaveBeenCalledTimes(1);
    expect(result.rows).toEqual([{ id: first, oldNumber: 10, newNumber: 43 }]);
    expect(tx.accountingBook.update).toHaveBeenCalledWith({
      where: { id: bookId },
      data: { nextNumber: 50 },
    });
  });
  it.each(['stale', 'missing', 'closed', 'empty'] as const)(
    'rejects %s before any numbering write',
    async (condition) => {
      const { tx, payload } = numbering();
      if (condition === 'stale') payload.items[0]!.expectedVersion = 1;
      if (condition === 'missing')
        tx.accountingJournal.findMany.mockResolvedValue([]);
      if (condition === 'closed')
        tx.accountingPeriod.findFirst.mockResolvedValue(null as never);
      if (condition === 'empty') payload.items = [];
      await expect(
        numberJournalPreview(tx as never, bookId, payload),
      ).rejects.toThrow();
      expect(tx.accountingJournal.updateMany).not.toHaveBeenCalled();
      expect(tx.accountingJournal.update).not.toHaveBeenCalled();
    },
  );
});
describe('same-date document reorder', () => {
  it('changes only daily order and version, preserving dates, period, amount and journal numbers', async () => {
    const { tx, payload, update } = fixture();
    await reorderJournals(tx as never, bookId, payload);
    expect(update.mock.calls.map(([call]) => call)).toEqual([
      {
        where: { id: second },
        data: {
          attributes: { auxiliaryNumber: 'keep', dailyNumber: '1' },
          version: { increment: 1 },
        },
      },
      {
        where: { id: first },
        data: {
          attributes: { auxiliaryNumber: 'keep', dailyNumber: '2' },
          version: { increment: 1 },
        },
      },
    ]);
    expect(tx.accountingJournal.findMany).toHaveBeenCalledWith({
      where: {
        bookId,
        documentDate: '2026-01-02',
        status: 'APPROVED',
      },
      take: 501,
    });
  });
  it.each([
    'stale',
    'missing',
    'duplicate',
    'posted',
    'draft',
    'closed',
  ] as const)('rejects %s before any update', async (condition) => {
    const { tx, payload, rows, update } = fixture();
    if (condition === 'stale') payload.items[0]!.expectedVersion = 1;
    if (condition === 'missing') payload.items.pop();
    if (condition === 'duplicate') payload.items[1]!.id = second;
    if (condition === 'posted') rows[1]!.status = 'POSTED';
    if (condition === 'draft') rows[1]!.status = 'DRAFT';
    if (condition === 'closed')
      tx.accountingPeriod.findFirst.mockResolvedValue(null as never);
    await expect(
      reorderJournals(tx as never, bookId, payload),
    ).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});

describe('observed per-destination template assignments', () => {
  const lines = () => [
    { role: 'TARGET', accountId: first, percentage: '50' },
    { role: 'TARGET', accountId: second, percentage: '25' },
    { role: 'SOURCE', accountId: periodId, parentPosition: 0 },
    { role: 'SOURCE', accountId: periodId, parentPosition: 1 },
  ];
  it('keeps each source attached to its own destination', () => {
    expect(validateTemplateAssignments(lines(), 'AUTOMATIC')).toEqual({
      '2': 0,
      '3': 1,
    });
  });
  it.each([
    'orphan',
    'child-parent',
    'self-source',
    'duplicate',
    'unassigned',
    'fraction',
  ])('rejects %s', (condition) => {
    const rows: Record<string, unknown>[] = lines();
    if (condition === 'orphan') rows[2]!.parentPosition = 99;
    if (condition === 'child-parent') rows[2]!.parentPosition = 3;
    if (condition === 'self-source') rows[2]!.accountId = first;
    if (condition === 'duplicate') rows.push({ ...rows[2] });
    if (condition === 'unassigned') rows.pop();
    if (condition === 'fraction') rows[0]!.percentage = '0.5';
    expect(() => validateTemplateAssignments(rows, 'AUTOMATIC')).toThrow();
  });
});
