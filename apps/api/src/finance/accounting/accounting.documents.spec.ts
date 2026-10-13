import { describe, expect, it, vi } from 'vitest';
import {
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
