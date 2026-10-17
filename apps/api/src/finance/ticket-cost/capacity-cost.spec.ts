import { describe, it, expect, vi } from 'vitest';
import { FinanceTicketCostService } from './finance-ticket-cost.service';
function fixture(end: string, sold = 40, type = 'COMPANY') {
  const service = new FinanceTicketCostService(
    {} as never,
    {
      listTicketPurchaseInbox: async () => [
        {
          id: 'purchase',
          offerId: 'offer',
          branchId: 'branch',
          status: 'PENDING',
        },
      ],
    } as never,
    undefined,
    {
      purchaseCapacityInventory: async () => [
        {
          id: 'offer',
          supplyType: type,
          allocatedCapacity: sold,
          arrivalAt: new Date(end),
        },
      ],
    } as never,
  );
  vi.spyOn(service, 'queueStates').mockResolvedValue(
    new Map([
      [
        'purchase',
        {
          seatCount: 50,
          invoiceAmount: '1000',
          currencyCode: 'USD',
          status: 'READY_FOR_PAYMENT',
        },
      ],
    ]) as never,
  );
  return service;
}
const actor = {
  branchIds: ['branch'],
  permissions: ['procurement.quote.manage'],
} as never;
describe('company capacity cost', () => {
  it('keeps ten unsold seats as remaining capacity before completion', async () => {
    const result = await fixture('2999-01-01').purchaseInbox(actor);
    expect(result.data[0]!.capacityCost).toMatchObject({
      unsoldSeats: 10,
      amount: '200',
      status: 'REMAINING_CAPACITY',
      currencyCode: 'USD',
    });
  });
  it('recognizes final loss after completion without charging contracts for unsold seats', async () => {
    const result = await fixture('2000-01-01').purchaseInbox(actor);
    expect(result.data[0]!.capacityCost).toMatchObject({
      amount: '200',
      status: 'FINAL_LOSS',
    });
  });
  it('does not invent loss when allocations exceed purchased seats', async () => {
    expect(
      (await fixture('2000-01-01', 51).purchaseInbox(actor)).data[0]!
        .capacityCost,
    ).toBeNull();
  });
  it('does not expose floating purchases in capacity purchase rows', async () => {
    expect(
      (await fixture('2000-01-01', 40, 'FLOATING').purchaseInbox(actor)).data,
    ).toEqual([]);
  });
});
