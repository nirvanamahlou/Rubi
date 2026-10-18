import { expect, it, vi } from 'vitest';
import { PackagePricingService } from './package-pricing.service';
it('requests exact occupancy tariffs through Reservations rather than filtering manual room rates out', async () => {
  const tour = {
    id: 'tour',
    branchId: 'branch',
    startsOn: '2026-10-01',
    endsOn: '2026-10-03',
    outboundOfferId: 'out',
    outbound: { version: 1 },
    package: { destinationId: 'city', hotelIds: ['hotel'] },
  };
  const batches = [
    {
      id: 'batch',
      rows: [
        {
          hotelId: 'hotel',
          roomRates: [{ occupancyRates: [{ adults: 2, amount: '100' }] }],
        },
      ],
    },
  ];
  const forTour = vi.fn().mockResolvedValue(batches);
  const pricing = new PackagePricingService(
    {} as never,
    {} as never,
    {} as never,
    { pricingDeparture: vi.fn().mockResolvedValue(tour) } as never,
    { forTour } as never,
    { paidCostsForOffers: vi.fn().mockResolvedValue([]) } as never,
  );
  const result = await pricing.tourCostGrid('tour', {
    branchIds: ['branch'],
  } as never);
  expect(result.purchaseBatches).toEqual(batches);
  expect(result.missingHotelIds).toEqual([]);
  expect(forTour).toHaveBeenCalledWith(
    'branch',
    ['hotel'],
    '2026-10-01',
    '2026-10-03',
    'tour',
    'city',
    true,
  );
});
