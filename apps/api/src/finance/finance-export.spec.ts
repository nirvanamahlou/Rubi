import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor, FinanceInboxItemV1 } from '@nora/contracts';
import { financeExportSnapshot } from './finance-export';
const actor = {
  userId: 'tester',
  branchIds: ['branch-a'],
  permissions: ['finance.read', 'finance.export'],
} as unknown as AuthenticatedActor;
const item = {
  id: 'case',
  source: 'FINANCE',
  kind: 'OPERATIONAL_REQUEST',
  sourceReference: 'case',
  branchReference: 'branch-a',
  title: 'حقوق',
  requesterDisplaySnapshot: 'کاربر',
  partyDisplaySnapshot: 'کارمند',
  status: 'NEW',
  amount: { amount: '100.125', currencyCode: 'IRR' },
  createdAt: '2026-10-01T10:00:00Z',
} as FinanceInboxItemV1;
function setup(items = [item]) {
  return {
    list: vi
      .fn()
      .mockResolvedValue({ items, sources: [{ connection: 'CONNECTED' }] }),
    history: vi.fn().mockResolvedValue({ items: [], nextCursor: null }),
  };
}
describe('Authorized Finance export snapshots', () => {
  it('requires both read and export permission before reading sources', async () => {
    const inbox = setup();
    await expect(
      financeExportSnapshot(
        inbox as never,
        {},
        { ...actor, permissions: ['finance.read'] },
      ),
    ).rejects.toThrow();
    expect(inbox.list).not.toHaveBeenCalled();
  });
  it('exports all filtered rows rather than the visible page, retaining exact currency totals', async () => {
    const inbox = setup([
      item,
      { ...item, id: 'two', amount: { amount: '0.875', currencyCode: 'IRR' } },
    ]);
    const result = await financeExportSnapshot(
      inbox as never,
      { page: 2, pageSize: 1 },
      actor,
    );
    expect(result.rows).toHaveLength(2);
    expect(result.totals).toEqual([{ currencyCode: 'IRR', amount: '101' }]);
    expect(result.filterSnapshot).not.toHaveProperty('page');
  });
  it('does not disguise an unavailable source as a complete export', async () => {
    const inbox = setup();
    inbox.list.mockResolvedValue({
      items: [],
      sources: [{ connection: 'UNAVAILABLE' }],
    });
    await expect(
      financeExportSnapshot(inbox as never, {}, actor),
    ).rejects.toThrow('ناقص');
  });
  it('rejects oversize exports without silent truncation', async () => {
    await expect(
      financeExportSnapshot(
        setup(
          Array.from({ length: 2001 }, (_, index) => ({
            ...item,
            id: String(index),
          })),
        ) as never,
        {},
        actor,
      ),
    ).rejects.toThrow('۲۰۰۰');
  });
  it('requires a persisted exact receipt identity and rejects missing or inaccessible records', async () => {
    const inbox = setup();
    await expect(
      financeExportSnapshot(inbox as never, { scope: 'RECEIPT' }, actor),
    ).rejects.toThrow();
    await expect(
      financeExportSnapshot(
        inbox as never,
        { scope: 'RECEIPT', historySource: 'OPERATIONAL', recordId: 'absent' },
        actor,
      ),
    ).rejects.toThrow('یافت نشد');
    expect(inbox.history).toHaveBeenCalledWith(
      { source: 'OPERATIONAL', recordId: 'absent' },
      actor,
    );
  });
  it('detects a repeating history page instead of duplicating payment receipts', async () => {
    const inbox = setup();
    inbox.history.mockResolvedValue({ items: [], nextCursor: 'same' });
    await expect(
      financeExportSnapshot(inbox as never, { scope: 'HISTORY' }, actor),
    ).rejects.toThrow('صفحه');
    expect(inbox.history).toHaveBeenCalledTimes(2);
  });
});
