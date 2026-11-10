import { expect, it, vi } from 'vitest';
import { Prisma } from '@nora/database';
import { FinanceTicketCostService } from './finance-ticket-cost.service';
it('exposes latest purchase recording date independently of request entry and payment date', async () => {
  const rows = [
    {
      id: 'cost-2',
      requestId: 'request',
      version: 2,
      createdAt: new Date('2026-10-09T23:59:59Z'),
      invoiceAmount: new Prisma.Decimal('100'),
      currencyCode: 'USD',
      seatCount: 1,
      unitCost: new Prisma.Decimal('100'),
      cumulativePaid: new Prisma.Decimal('100'),
      remainingAmount: new Prisma.Decimal('0'),
      paymentCount: 1,
    },
  ];
  const procurement = {
    listTicketPurchaseInbox: vi
      .fn()
      .mockResolvedValue([
        { id: 'request', createdAt: '2026-09-01', status: 'PENDING' },
      ]),
  };
  const service = new FinanceTicketCostService(
    {
      client: {
        $queryRaw: vi.fn().mockResolvedValue(rows),
      },
    } as never,
    procurement as never,
  );
  const actor = {
    userId: 'authorized',
    branchIds: ['b'],
    permissions: ['procurement.read.own'],
  } as never;
  const result = await service.purchaseInbox(actor);
  expect(procurement.listTicketPurchaseInbox).toHaveBeenCalledWith(actor);
  expect(result.data[0]!.cost).toMatchObject({
    version: 2,
    createdAt: '2026-10-09T23:59:59.000Z',
  });
});
