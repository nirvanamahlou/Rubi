import { expect, it, vi } from 'vitest';
import { FinanceTicketCostService } from './finance-ticket-cost.service';
it('uses current load for unpriced requests and keeps recorded purchase quantities immutable', async () => {
  const requests = [
    {
      id: 'unpriced',
      offerId: 'offer',
      branchId: 'branch',
      seatCount: 60,
      status: 'PENDING',
    },
    {
      id: 'priced',
      offerId: 'offer',
      branchId: 'branch',
      seatCount: 60,
      status: 'PENDING',
    },
    {
      id: 'floating',
      offerId: 'float',
      branchId: 'branch',
      seatCount: 1,
      status: 'PENDING',
    },
  ];
  const inventory = [
    {
      id: 'offer',
      branchId: 'branch',
      totalCapacity: 50,
      allocatedCapacity: 11,
      destinationId: 'city',
      supplyType: 'COMPANY',
      arrivalAt: new Date('2030-01-01'),
    },
    { id: 'float', supplyType: 'FLOATING' },
  ];
  const service = new FinanceTicketCostService(
    {} as never,
    { listTicketPurchaseInbox: vi.fn(async () => requests) } as never,
    undefined,
    { purchaseCapacityInventory: vi.fn(async () => inventory) } as never,
  );
  vi.spyOn(service, 'queueStates').mockResolvedValue(
    new Map([
      [
        'priced',
        {
          createdAt: null,
          costVersion: 1,
          costRevisionId: 'cost',
          invoiceAmount: '600',
          currencyCode: 'USD',
          seatCount: 60,
          unitCost: '10',
          paymentCount: 1,
          paidAmount: '100',
          remainingAmount: '500',
          status: 'PAYING',
        },
      ],
    ]),
  );
  const result = await service.purchaseInbox({
    branchIds: ['branch'],
    permissions: ['procurement.quote.manage'],
  } as never);
  expect(result.data).toHaveLength(2);
  expect(result.data[0]).toMatchObject({
    request: { seatCount: 50 },
    currentCapacity: { total: 50, allocated: 11, destinationId: 'city' },
    cost: null,
  });
  expect(result.data[1]).toMatchObject({
    request: { seatCount: 60 },
    currentCapacity: { total: 50 },
    cost: { seatCount: 60, invoiceAmount: '600', paidAmount: '100' },
  });
  expect(requests[0]?.seatCount).toBe(60);
});
