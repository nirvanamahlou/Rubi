import 'reflect-metadata';
import { expect, it, vi } from 'vitest';
import { SalesFloatingPurchases } from './sales-floating-purchases';
const actor = {
  userId: 'seller',
  branchIds: ['branch'],
  permissions: [
    'sales.contracts.create',
    'sales.contracts.read.own',
    'screen.sales.new-contract.view',
  ],
} as never;
function setup() {
  const sales = {
    detail: vi
      .fn()
      .mockResolvedValue({
        data: {
          id: 'contract',
          ownerUserId: 'seller',
          branchId: 'branch',
          status: 'SENT_TO_RESERVATIONS',
        },
      }),
  };
  const current = {
    id: 'intake',
    contractId: 'contract',
    snapshot: {
      serviceSelections: [
        { kind: 'FLIGHT', metadata: { contractFlightVersion: 1 } },
      ],
    },
  };
  const reservations = {
    contractPurchaseContext: vi.fn().mockResolvedValue(current),
    purchaseContext: vi.fn().mockResolvedValue(current),
  };
  const purchases = {
    record: vi.fn().mockResolvedValue({ data: { id: 'cost' } }),
    recordBatch: vi.fn().mockResolvedValue({ data: { id: 'batch' } }),
  };
  const agencies = {
    agencyPurchaseOptions: vi
      .fn()
      .mockResolvedValue({
        data: [{ id: 'agency', name: 'Agency' }],
        meta: { total: 1 },
      }),
  };
  const service = new SalesFloatingPurchases(
    sales as never,
    reservations as never,
    {
      detail: vi.fn().mockResolvedValue({ workflow: { version: 1 } }),
    } as never,
    purchases as never,
    { voucherCurrencies: vi.fn() } as never,
    { quote: vi.fn() } as never,
    agencies as never,
  );
  return { service, sales, reservations, purchases, agencies, current };
}
it('denies foreign contract reads before exposing purchase context or references', async () => {
  const h = setup();
  h.sales.detail.mockRejectedValue(new Error('denied'));
  await expect(
    h.service.reference('foreign', 'voucher-brokers', '1', '', actor),
  ).rejects.toThrow();
  expect(h.reservations.contractPurchaseContext).not.toHaveBeenCalled();
  expect(h.agencies.agencyPurchaseOptions).not.toHaveBeenCalled();
});
it('authorizes owner Sales self-service without Reservations grants and forwards the exact contract and idempotency key', async () => {
  const h = setup();
  await h.service.record('contract', {} as never, actor, 'unique');
  expect(h.purchases.record).toHaveBeenCalledWith(
    'intake',
    {},
    actor,
    'unique',
    'contract',
  );
  await h.service.reference(
    'contract',
    'voucher-brokers',
    '1',
    'agency',
    actor,
  );
  expect(h.agencies.agencyPurchaseOptions).toHaveBeenCalledWith('agency', 1);
});
it('rejects a nonfloating, other-contract or out-of-branch context before writing', async () => {
  for (const mode of ['regular', 'other', 'branch']) {
    const h = setup();
    if (mode === 'regular')
      h.current.snapshot.serviceSelections[0]!.metadata.contractFlightVersion = 0;
    if (mode === 'other') h.current.contractId = 'other';
    if (mode === 'branch')
      h.sales.detail.mockResolvedValue({
        data: {
          id: 'contract',
          ownerUserId: 'seller',
          branchId: 'other',
          status: 'SENT_TO_RESERVATIONS',
        },
      });
    await expect(
      h.service.batch('contract', {} as never, actor, 'k'),
    ).rejects.toThrow();
    expect(h.purchases.recordBatch).not.toHaveBeenCalled();
  }
});
