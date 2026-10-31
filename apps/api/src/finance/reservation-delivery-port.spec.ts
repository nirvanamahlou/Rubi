import { describe, expect, it, vi } from 'vitest';
import { FinanceInboxService } from './finance-inbox.service';
import type { AuthenticatedActor } from '@nora/contracts';
function setup() {
  const sales = {
    financeCustomerDocumentDeliveryFacts: vi
      .fn()
      .mockResolvedValue({ contractId: 'contract', branchId: 'branch' }),
  };
  const delivery = {
    readCustomerContract: vi.fn().mockResolvedValue({ version: 2 }),
    updateCustomerContract: vi.fn().mockResolvedValue({ version: 3 }),
  };
  const service = new FinanceInboxService(
    sales as never,
    {} as never,
    {} as never,
    delivery as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, sales, delivery };
}
const actor = {
  userId: 'u',
  branchIds: ['branch'],
  permissions: ['reservations.documents.manage'],
} as unknown as AuthenticatedActor;
describe('reservation minimal delivery port', () => {
  it('uses Sales public branch verification before returning only the authorization', async () => {
    const { service, sales, delivery } = setup();
    expect(
      await service.reservationDocumentDelivery('contract', actor),
    ).toEqual({ version: 2 });
    expect(sales.financeCustomerDocumentDeliveryFacts).toHaveBeenCalledWith(
      'contract',
      ['branch'],
    );
    expect(delivery.readCustomerContract).toHaveBeenCalledWith('contract');
  });
  it('rejects unauthorized, other-branch and foreign basis requests before writing', async () => {
    const { service, sales, delivery } = setup();
    await expect(
      service.reservationDocumentDelivery('contract', {
        ...actor,
        permissions: ['reservations.read'],
      }),
    ).rejects.toThrow();
    expect(sales.financeCustomerDocumentDeliveryFacts).not.toHaveBeenCalled();
    await expect(
      service.decideReservationDocumentDelivery(
        'contract',
        { basis: 'FULL_SETTLEMENT' } as never,
        actor,
      ),
    ).rejects.toThrow();
    expect(delivery.updateCustomerContract).not.toHaveBeenCalled();
    sales.financeCustomerDocumentDeliveryFacts.mockRejectedValue(
      new Error('out of branch'),
    );
    await expect(
      service.reservationDocumentDelivery('outside', actor),
    ).rejects.toThrow('branch');
    expect(delivery.readCustomerContract).not.toHaveBeenCalled();
  });
});
