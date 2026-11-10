import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { FinanceInboxService } from './finance-inbox.service';
const actor = {
  userId: 'actor',
  branchIds: ['branch'],
  permissions: ['finance.read', 'finance.payment.create'],
} as AuthenticatedActor;
const id1 = '10000000-0000-4000-8000-000000000001',
  id2 = '10000000-0000-4000-8000-000000000002';
const intake = (index: number) => ({
  id: 'intake-' + index,
  branchId: 'branch',
  snapshot: { contractNumber: 'SYN-' + index },
  servicePurchases: [
    {
      id: 'purchase-' + index,
      serviceTitle: 'Synthetic hotel',
      supplierName: 'Synthetic supplier',
      amount: '10',
      currencyCode: 'EUR',
      createdAt: '2026-10-01T00:00:00Z',
      finance: {
        version: 0,
        status: 'PENDING',
        paidAmount: '0',
        remainingAmount: '10',
      },
    },
  ],
});
function setup(reservations: unknown, fx?: unknown) {
  const tx = {},
    transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn(tx),
    );
  const service = new FinanceInboxService(
    { financeInbox: vi.fn().mockResolvedValue([]) } as never,
    { readFinanceInbox: vi.fn().mockResolvedValue([]) } as never,
    reservations as never,
    {} as never,
    {
      client: {
        $transaction: transaction,
        financeOperationalRequest: { findMany: vi.fn().mockResolvedValue([]) },
      },
    } as never,
    {
      listFinanceTicketPurchases: vi.fn().mockResolvedValue([]),
      listFinanceInvoiceSources: vi.fn().mockResolvedValue([]),
      listFinanceCorrections: vi.fn().mockResolvedValue([]),
    } as never,
    { queueStates: vi.fn().mockResolvedValue(new Map()) } as never,
    undefined,
    undefined,
    fx as never,
  );
  return { service, transaction, tx };
}
describe('complete reservation purchase inbox', () => {
  it('uses the purchase-specific public projection beyond 100 rows and keeps prior-intake evidence', async () => {
    const list = vi.fn(),
      listForFinance = vi.fn().mockResolvedValue([
        ...Array.from({ length: 126 }, (_, n) => intake(n)),
        {
          ...intake(999),
          id: 'earlier-intake',
          snapshot: { contractNumber: 'SYN-0' },
        },
      ]);
    const f = setup({ list, listForFinance }),
      result = await f.service.list(actor);
    expect(result.items).toHaveLength(127);
    expect(
      result.items.some((i) => i.sourceContextReference === 'earlier-intake'),
    ).toBe(true);
    expect(list).not.toHaveBeenCalled();
    expect(listForFinance).toHaveBeenCalledWith(['branch'], actor);
  });
  it('fully pages compatible older adapters instead of silently stopping at 100', async () => {
    const rows = Array.from({ length: 126 }, (_, n) => intake(n));
    const list = vi
      .fn()
      .mockResolvedValueOnce(rows.slice(0, 100))
      .mockResolvedValueOnce(rows.slice(100));
    const result = await setup({ list }).service.list(actor);
    expect(result.items).toHaveLength(126);
    expect(list).toHaveBeenNthCalledWith(2, ['branch'], { page: '2', actor });
  });
  it('marks an inconsistent page source unavailable rather than showing duplicate payable rows', async () => {
    const rows = Array.from({ length: 100 }, (_, n) => intake(n));
    const list = vi.fn().mockResolvedValue(rows);
    const result = await setup({ list }).service.list(actor);
    expect(result.items).toHaveLength(0);
    expect(
      result.sources.find((s) => s.source === 'RESERVATIONS')?.connection,
    ).toBe('UNAVAILABLE');
  });
});
function fxSetup(secondCurrency = 'EUR') {
  const capture = vi.fn(
    async (_tx: unknown, input: { reservationPurchaseId: string }) => ({
      id: input.reservationPurchaseId,
    }),
  );
  const f = setup({}, { capture });
  const item = {
    id: 'reservations:batch',
    branchReference: 'branch',
    createdAt: '2026-10-01T00:00:00Z',
    reservationPurchase: {
      lines: [
        { purchaseId: id1, amount: '10', currencyCode: 'EUR' },
        { purchaseId: id2, amount: '2', currencyCode: secondCurrency },
      ],
    },
  };
  vi.spyOn(f.service, 'list').mockResolvedValue({ items: [item] } as never);
  return { ...f, capture };
}
describe('one manual FX rate for a grouped purchase', () => {
  it('captures separate immutable amounts under one rate in one transaction', async () => {
    const f = fxSetup();
    await f.service.capturePurchaseFx(id1, '500000', actor, [id2]);
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.capture).toHaveBeenCalledTimes(2);
    expect(f.capture.mock.calls.map((c) => c[1])).toEqual([
      expect.objectContaining({
        reservationPurchaseId: id1,
        amount: '10',
        currencyCode: 'EUR',
        rateToIrr: '500000',
      }),
      expect.objectContaining({
        reservationPurchaseId: id2,
        amount: '2',
        currencyCode: 'EUR',
        rateToIrr: '500000',
      }),
    ]);
    expect(f.capture.mock.calls.every((c) => c[0] === f.tx)).toBe(true);
  });
  it('preserves the old single-capture response and ignores duplicate identities', async () => {
    const f = fxSetup();
    expect(await f.service.capturePurchaseFx(id1, '500000', actor)).toEqual({
      id: id1,
    });
    await f.service.capturePurchaseFx(id1, '500000', actor, [id1]);
    expect(f.capture).toHaveBeenCalledTimes(2);
  });
  it('rejects mixed currencies and foreign purchase IDs before writes', async () => {
    const f = fxSetup('USD');
    await expect(
      f.service.capturePurchaseFx(id1, '500000', actor, [id2]),
    ).rejects.toThrow();
    expect(f.transaction).not.toHaveBeenCalled();
    await expect(
      f.service.capturePurchaseFx(id1, '500000', actor, [
        '10000000-0000-4000-8000-000000000099',
      ]),
    ).rejects.toThrow();
    expect(f.transaction).not.toHaveBeenCalled();
  });
  it('propagates a later immutable-rate conflict to roll back the whole group', async () => {
    const f = fxSetup();
    f.capture
      .mockResolvedValueOnce({ id: id1 })
      .mockRejectedValueOnce(new Error('Immutable rate conflict'));
    await expect(
      f.service.capturePurchaseFx(id1, '500000', actor, [id2]),
    ).rejects.toThrow('Immutable rate conflict');
    expect(f.transaction).toHaveBeenCalledTimes(1);
    expect(f.capture).toHaveBeenCalledTimes(2);
  });
  it('rejects missing permission, cross-branch sources and malformed batch input', async () => {
    const f = fxSetup();
    await expect(
      f.service.capturePurchaseFx(id1, '1', { ...actor, permissions: [] }),
    ).rejects.toThrow();
    await expect(
      f.service.capturePurchaseFx(id1, '1', { ...actor, branchIds: ['other'] }),
    ).rejects.toThrow();
    await expect(
      f.service.capturePurchaseFx(id1, '1', actor, 'invalid' as never),
    ).rejects.toThrow();
    expect(f.transaction).not.toHaveBeenCalled();
  });
});
