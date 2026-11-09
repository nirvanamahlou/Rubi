import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { voidSalesReceipt } from './void-sales-receipt';

const sales = vi.hoisted(() => ({
  readSalesReceiptForVoid: vi.fn(),
  applySalesReceiptVoid: vi.fn(),
}));
vi.mock('../../sales/sales-receipt-void.public', () => sales);
const actor = {
  userId: 'reviewer',
  branchIds: ['branch'],
  permissions: ['finance.read', 'finance.receipt.approve'],
} as AuthenticatedActor;
const command = { version: 7, reason: 'Duplicate entry' };
function setup(journal: object | null, refunds = 0) {
  vi.clearAllMocks();
  sales.readSalesReceiptForVoid.mockResolvedValue({
    id: 'duplicate',
    status: 'FINANCE_CONFIRMED',
    allocations: [],
    contract: { version: 7, branchId: 'branch' },
    _count: { refunds, financeRefundRequests: 0 },
  });
  const tx = {
    $queryRaw: vi.fn(),
    financeAccountingEvent: {
      findFirst: vi
        .fn()
        .mockResolvedValue({
          journal,
          _count: { financialWorkflows: 0 },
          derivedEvents: [],
        }),
    },
  };
  return {
    client: { $transaction: (work: (input: typeof tx) => unknown) => work(tx) },
  } as never;
}

describe('confirmed receipt void', () => {
  it.each([
    null,
    { status: 'CANCELLED' },
    { status: 'POSTED', reversal: { status: 'POSTED' } },
  ])(
    'voids a receipt whose journal is settled for void (%j)',
    async (journal) => {
      await expect(
        voidSalesReceipt(
          setup(journal),
          actor,
          {},
          'contract',
          'duplicate',
          command,
        ),
      ).resolves.toEqual({ voided: true });
      expect(sales.applySalesReceiptVoid).toHaveBeenCalledOnce();
    },
  );
  it.each([
    { status: 'DRAFT' },
    { status: 'POSTED', reversal: { status: 'DRAFT' } },
  ])(
    'keeps the receipt effective until its journal is resolved (%j)',
    async (journal) => {
      await expect(
        voidSalesReceipt(
          setup(journal),
          actor,
          {},
          'contract',
          'duplicate',
          command,
        ),
      ).rejects.toThrow();
      expect(sales.applySalesReceiptVoid).not.toHaveBeenCalled();
    },
  );
  it('blocks a receipt with a refund and rejects stale previews', async () => {
    await expect(
      voidSalesReceipt(
        setup(null, 1),
        actor,
        {},
        'contract',
        'duplicate',
        command,
      ),
    ).rejects.toThrow();
    await expect(
      voidSalesReceipt(setup(null), actor, {}, 'contract', 'duplicate', {
        ...command,
        version: 6,
      }),
    ).rejects.toThrow();
    expect(sales.applySalesReceiptVoid).not.toHaveBeenCalled();
  });
});
