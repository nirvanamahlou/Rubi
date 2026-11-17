import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { SiteCommerceService } from './site-commerce.service';
type Mock = ReturnType<typeof vi.fn>;
type Facts = {
  cancelled: boolean;
  hasConfirmedPayment: boolean;
  fullySettled: boolean;
};
type Harness = {
  releaseSettledWebsiteDocuments: (
    row: { contractId: string; paymentFingerprint: null },
    actor: AuthenticatedActor,
  ) => Promise<unknown>;
  status: SiteCommerceService['status'];
  order: Mock;
  sales: { detail: Mock; financeCustomerDocumentDeliveryFacts: Mock };
  delivery: { readCustomerContract: Mock; updateCustomerContract: Mock };
};
const actor = {
  userId: 'synthetic-user',
  branchIds: ['branch'],
  permissions: [],
} as AuthenticatedActor;
function fixture(facts: Facts, version = 0) {
  const service = Object.create(SiteCommerceService.prototype) as Harness;
  const row = { contractId: 'contract', paymentFingerprint: null };
  const current = { version, approved: false };
  service.order = vi.fn().mockResolvedValue({ row, scoped: actor });
  service.sales = {
    detail: vi.fn().mockResolvedValue({ data: { id: 'contract' } }),
    financeCustomerDocumentDeliveryFacts: vi.fn().mockResolvedValue(facts),
  };
  service.delivery = {
    readCustomerContract: vi.fn().mockResolvedValue(current),
    updateCustomerContract: vi
      .fn()
      .mockResolvedValue({ version: 1, approved: true }),
  };
  return { service, row, current };
}
describe('Native gateway settlement and document policy', () => {
  for (const [confirmed, settled, cancelled, expected] of [
    [true, true, false, 'paid'],
    [false, true, false, 'unpaid'],
    [true, false, false, 'unpaid'],
    [true, true, true, 'unpaid'],
  ] as const)
    it(
      'reports authoritative payment status ' +
        JSON.stringify([confirmed, settled, cancelled]),
      async () => {
        const f = fixture({
          hasConfirmedPayment: confirmed,
          fullySettled: settled,
          cancelled,
        });
        expect(
          (await f.service.status('nss', 'order', actor)).data.paymentStatus,
        ).toBe(expected);
      },
    );
  it('opens only a pristine permission after confirmed full settlement', async () => {
    const f = fixture({
      cancelled: false,
      hasConfirmedPayment: true,
      fullySettled: true,
    });
    await f.service.releaseSettledWebsiteDocuments(f.row, actor);
    expect(f.service.delivery.updateCustomerContract).toHaveBeenCalledWith(
      expect.objectContaining({
        approved: true,
        basis: 'FULL_SETTLEMENT',
        expectedVersion: 0,
      }),
      expect.anything(),
      actor,
      expect.any(Function),
    );
  });
  for (const facts of [
    { cancelled: true, hasConfirmedPayment: true, fullySettled: true },
    { cancelled: false, hasConfirmedPayment: false, fullySettled: true },
    { cancelled: false, hasConfirmedPayment: true, fullySettled: false },
  ])
    it('keeps documents blocked for ' + JSON.stringify(facts), async () => {
      const f = fixture(facts);
      await f.service.releaseSettledWebsiteDocuments(f.row, actor);
      expect(f.service.delivery.updateCustomerContract).not.toHaveBeenCalled();
    });
  it('does not override an explicitly revoked document permission', async () => {
    const f = fixture(
      { cancelled: false, hasConfirmedPayment: true, fullySettled: true },
      2,
    );
    await f.service.releaseSettledWebsiteDocuments(f.row, actor);
    expect(f.service.delivery.updateCustomerContract).not.toHaveBeenCalled();
  });
  it('rechecks settlement inside the native authorization transaction', async () => {
    const f = fixture({
      cancelled: false,
      hasConfirmedPayment: true,
      fullySettled: true,
    });
    f.service.sales.financeCustomerDocumentDeliveryFacts
      .mockResolvedValueOnce({
        cancelled: false,
        hasConfirmedPayment: true,
        fullySettled: true,
      })
      .mockResolvedValue({
        cancelled: false,
        hasConfirmedPayment: false,
        fullySettled: false,
      });
    f.service.delivery.updateCustomerContract.mockImplementation(
      async (
        _input: unknown,
        _facts: unknown,
        _actor: unknown,
        validate: (tx: unknown) => Promise<unknown>,
      ) => {
        await validate({});
        throw Error('must not approve');
      },
    );
    expect(
      await f.service.releaseSettledWebsiteDocuments(f.row, actor),
    ).toEqual(f.current);
  });
});
