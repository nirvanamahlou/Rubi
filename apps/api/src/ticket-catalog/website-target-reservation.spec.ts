import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@nora/database';
import { TicketPublicService } from './ticket-public.service';
const id = (n: number) =>
  '10000000-0000-4000-8000-' + String(n).padStart(12, '0');
function fixture() {
  const selection = {
    serviceClientKey: 'out',
    direction: 'OUTBOUND' as const,
    offerId: id(1),
    originId: id(2),
    destinationId: id(3),
    departureAt: '2099-01-01T08:00:00.000Z',
    arrivalAt: '2099-01-01T10:00:00.000Z',
    cabinClassCode: 'ECONOMY',
    carrierNameSnapshot: 'Synthetic',
    serviceNumberSnapshot: 'S1',
  };
  const offer = {
    ...selection,
    id: id(1),
    branchId: id(4),
    departureAt: new Date(selection.departureAt),
    arrivalAt: new Date(selection.arrivalAt),
    carrierName: 'Synthetic',
    serviceNumber: 'S1',
    totalCapacity: 3,
    capacityAllocations: [] as { quantity: number }[],
    capacityHolds: [] as { quantity: number }[],
  };
  const tx = {
    $queryRaw: vi.fn(),
    ticketPublishedOffer: { findMany: vi.fn().mockResolvedValue([offer]) },
    ticketOfferCapacityAllocation: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: id(8) }),
    },
    ticketSalePriceTarget: {
      findFirst: vi.fn().mockResolvedValue({ id: id(5) }),
    },
    ticketOfferStandaloneSalePrice: {
      findFirst: vi
        .fn()
        .mockResolvedValue({
          amount: new Prisma.Decimal(100),
          currencyCode: 'IRR',
          tiers: [],
        }),
    },
    ticketSaleCommissionRevision: {
      findFirst: vi.fn().mockResolvedValue({ percent: new Prisma.Decimal(4) }),
    },
  };
  const service = new TicketPublicService(
    {
      client: { $transaction: (fn: (t: typeof tx) => unknown) => fn(tx) },
    } as never,
    {} as never,
  );
  const reserve = (amount = '192') =>
    service.reserve([selection], id(4), id(6), 2, {
      out: { amount, currencyCode: 'IRR', salePriceTargetId: id(5) },
    });
  return { offer, tx, reserve };
}
describe('website final ERP reservation', () => {
  it('uses the saved destination for flat fares inside the locked reservation', async () => {
    const f = fixture();
    expect((await f.reserve()).available).toBe(true);
    expect(
      f.tx.ticketSaleCommissionRevision.findFirst.mock.calls[0]?.[0].where
        .salePriceTargetId,
    ).toBe(id(5));
  });
  it('matches checkout rounding for fractional destination amounts', async () => {
    const f = fixture();
    f.tx.ticketOfferStandaloneSalePrice.findFirst.mockResolvedValue({
      amount: new Prisma.Decimal('100.01'),
      currencyCode: 'IRR',
      tiers: [],
    });
    expect((await f.reserve('192.02')).available).toBe(true);
  });
  it('rejects a changed destination price without allocating seats', async () => {
    const f = fixture();
    await expect(f.reserve('200')).rejects.toThrow();
    expect(f.tx.ticketOfferCapacityAllocation.create).not.toHaveBeenCalled();
  });
  it('rejects missing or hidden destination prices without allocating seats', async () => {
    for (const rate of [null, { percent: new Prisma.Decimal(100) }]) {
      const f = fixture();
      f.tx.ticketSaleCommissionRevision.findFirst.mockResolvedValue(
        rate as never,
      );
      await expect(f.reserve()).rejects.toThrow();
      expect(f.tx.ticketOfferCapacityAllocation.create).not.toHaveBeenCalled();
    }
  });
  it('re-reads current allocations and holds before every purchase, even for a previously available quote', async () => {
    const f = fixture();
    f.offer.capacityAllocations.push({ quantity: 1 });
    f.offer.capacityHolds.push({ quantity: 1 });
    expect((await f.reserve()).available).toBe(false);
    expect(f.tx.ticketOfferCapacityAllocation.create).not.toHaveBeenCalled();
  });
});
