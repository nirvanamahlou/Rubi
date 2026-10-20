import { describe, it, expect, vi } from 'vitest';
import { FinanceDeliveryService } from './finance-delivery.module';
const facts = { contractId: 'contract', branchId: 'branch', salesOwnerUserId: 'sales', hasConfirmedPayment: true, fullySettled: true };
const actor = { userId: 'finance', permissions: ['finance.financial_release.approve'] };
const command = { expectedVersion: 0, approved: true, basis: 'FULL_SETTLEMENT' as const, reason: '' };
describe('customer release uses financial facts under its transaction lock', () => {
  function setup() {
    const tx = { $queryRaw: vi.fn().mockResolvedValue([]), financeCustomerDocumentDeliveryRevision: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn() } };
    const service = new FinanceDeliveryService({ client: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) } } as never, { createWithinTransaction: vi.fn() } as never);
    return { tx, service };
  }
  it('rejects a previously settled contract when the refreshed balance is outstanding', async () => {
    const { tx, service } = setup();
    const refresh = vi.fn().mockResolvedValue({ ...facts, fullySettled: false });
    await expect(service.updateCustomerContract(command, facts, actor, refresh)).rejects.toThrow('تسویه کامل');
    expect(refresh).toHaveBeenCalledWith(tx);
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.financeCustomerDocumentDeliveryRevision.create).not.toHaveBeenCalled();
  });
  it('rejects cancelled contracts even when the cached settlement was complete', async () => {
    const { tx, service } = setup();
    await expect(service.updateCustomerContract(command, facts, actor, async () => ({ ...facts, cancelled: true }))).rejects.toThrow('لغوشده');
    expect(tx.financeCustomerDocumentDeliveryRevision.create).not.toHaveBeenCalled();
  });
});
