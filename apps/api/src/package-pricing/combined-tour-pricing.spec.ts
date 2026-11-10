import { expect, it, vi } from 'vitest';
import { PackageTourPricingService } from './package-tour-pricing.service';
import {
  packageRoomCode,
  tourPriceFields,
  type PackageTourCostGridV1,
  type AuthenticatedActor,
  type SalesContractCreateRequest,
} from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import { PackagePricingService } from './package-pricing.service';

const actor = {
  userId: 'user',
  branchIds: ['branch'],
  permissions: ['sales.contracts.create'],
} as AuthenticatedActor;
function setup() {
  const rooms = [0, 1].map((i) => ({
    rateId: `rate-${i}`,
    roomCode: packageRoomCode({
      roomTypeId: `room-${i}`,
      adults: 2,
      childAges: [],
      board: 'BB',
    }),
  }));
  const grid = {
    version: 1,
    nights: 4,
    tour: {
      id: 'tour',
      version: 1,
      branchId: 'branch',
      startsOn: '2026-11-01',
      endsOn: '2026-11-05',
      remainingCapacity: 10,
      outboundOfferId: 'out',
      outbound: { cabinClassCode: 'ECONOMY' },
      package: {
        hotelIds: [],
        destinationId: 'city-0',
        details: {
          version: 1,
          isCombined: true,
          destinations: [
            { cityId: 'city-0', nights: 2 },
            { cityId: 'city-1', nights: 2 },
          ],
        },
      },
    },
    missingFlightOfferIds: ['out'],
    flightPurchaseCosts: [],
    purchaseBatches: [0, 1].map((i) => ({
      id: `batch-${i}`,
      branchId: 'branch',
      cityId: `city-${i}`,
      currencyCode: 'EUR',
      method: 'STAY',
      checkIn: i ? '2026-11-03' : '2026-11-01',
      checkOut: i ? '2026-11-05' : '2026-11-03',
      rows: [
        {
          id: `rate-${i}`,
          batchId: `batch-${i}`,
          hotelId: `hotel-${i}`,
          hotelName: `Hotel ${i}`,
          basePerNight: '0',
          factors: {},
          roomRates: [
            {
              roomTypeId: `room-${i}`,
              roomTypeName: `Room ${i}`,
              factor: '1',
              maxAdults: 2,
              maxChildren: 0,
              occupancyRates: [
                {
                  startsOn: '2026-11-01',
                  endsOnExclusive: '2026-11-05',
                  adults: 2,
                  childAges: [],
                  amount: String((i + 1) * 100),
                  currencyCode: 'EUR',
                  board: 'BB',
                },
              ],
            },
          ],
        },
      ],
    })),
  } as unknown as PackageTourCostGridV1;
  let draft: Record<string, unknown> | null = null;
  const publications: Record<string, unknown>[] = [];
  const create = vi.fn(async ({ data }) => {
    const p = {
      ...data,
      roomPrices: data.roomPrices.create,
      publishedAt: new Date(),
    };
    publications.push(p);
    return p;
  });
  const tx = {
    $queryRaw: vi.fn(),
    packagePricingTourCombinationSource: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    packagePricingTourDraft: {
      findUnique: vi.fn(async () => draft),
      create: vi.fn(
        async ({ data }) =>
          (draft = {
            ...data,
            rialConversion: null,
            version: 1,
            adjustments: [],
          }),
      ),
      findUniqueOrThrow: vi.fn(async () => draft),
    },
    packagePricingTourPublishedVersion: {
      findFirst: vi.fn(async () => null),
      create,
    },
  };
  const db = {
    client: {
      packagePricingTourDraft: {
        findFirst: vi.fn(async () => draft),
        findMany: vi.fn(async () =>
          draft ? [{ ...draft, publications }] : [],
        ),
      },
      $transaction: vi.fn(async (f) => f(tx)),
    },
  } as unknown as DatabaseService;
  const service = new PackageTourPricingService(db, {
    tourCostGrid: vi.fn(async () => grid),
  } as unknown as PackagePricingService);
  const input = {
    version: 1 as const,
    expectedVersion: 0,
    tourDepartureId: 'tour',
    batchId: 'batch-0',
    currencyCode: 'EUR',
    adultFlightSale: '10',
    childFlightSale: '5',
    businessUplift: '0',
    commissionPercent: '0',
    priceFields: tourPriceFields({
      currencyCode: 'EUR',
      adultFlightSale: '10',
      childFlightSale: '5',
    }),
    adjustments: [],
    hotelCombinations: [
      { id: 'combo', rooms, sales: [{ currencyCode: 'EUR', amount: '750' }] },
    ],
  };
  return { service, input, create, grid, tx };
}
it('saves independent sources, freezes one shared sale and adds airfare once across two hotels', async () => {
  const { service, input, create } = setup();
  const saved = await service.save(input, actor);
  expect(saved.hotelCombinations).toEqual(input.hotelCombinations);
  const pub = await service.publish(
    saved.id,
    { version: 1, expectedDraftVersion: 1, reason: '' },
    actor,
  );
  expect(pub.roomPrices).toEqual([]);
  expect(pub.hotelCombinations?.[0]?.purchase).toEqual([
    { currencyCode: 'EUR', amount: '600.00' },
  ]);
  expect(pub.hotelCombinations?.[0]?.prices).toEqual([
    { currencyCode: 'EUR', amount: '750.00' },
  ]);
  const catalog = await service.saleCatalog('tour', actor);
  expect(catalog.data).toHaveLength(1);
  const p = catalog.data[0]!;
  expect(p.prices).toEqual([{ currencyCode: 'EUR', amount: '770.00' }]);
  expect(p.stays?.map((s) => s.hotelId)).toEqual(['hotel-0', 'hotel-1']);
  expect(JSON.stringify(p)).not.toContain('600.00');
  const quote = {
    tourDepartureId: 'tour',
    items: [{ publicationId: pub.id, roomCode: p.roomCode }],
    prices: p.prices,
  };
  const request = {
    services: [
      {
        metadata: {
          tourDepartureId: 'tour',
          packagePublishedSale: JSON.stringify(quote),
        },
      },
    ],
    hotelSelection: {
      hotelId: 'hotel-0',
      checkInDate: '2026-11-01',
      checkOutDate: '2026-11-03',
      rooms: [{ roomTypeId: 'room-0', adults: 2, childAges: [] }],
      additionalStays: [
        {
          hotelId: 'hotel-1',
          checkInDate: '2026-11-03',
          checkOutDate: '2026-11-05',
          rooms: [{ roomTypeId: 'room-1', adults: 2, childAges: [] }],
        },
      ],
    },
    priceComponents: [{ type: 'BASE', currencyCode: 'EUR', amount: '770' }],
  } as unknown as SalesContractCreateRequest;
  await expect(
    service.validateContractSale(request, actor, 'branch'),
  ).resolves.toBe('hotel-0');
  request.hotelSelection!.additionalStays![0]!.hotelId = 'forged';
  await expect(
    service.validateContractSale(request, actor, 'branch'),
  ).rejects.toThrow('مطابقت ندارد');
  expect(create).toHaveBeenCalledTimes(1);
  expect(
    create.mock.calls[0]?.[0].data.combinationSources.create.map(
      (s: { hotelRateId: string }) => s.hotelRateId,
    ),
  ).toEqual(['rate-0', 'rate-1']);
});

it('reads each city rate at its own consecutive period, including different countries', async () => {
  const { grid } = setup();
  const forTour = vi.fn(async (_branch, _hotels, _from, _to, _tour, city) =>
    grid.purchaseBatches.filter((b) => b.cityId === city),
  );
  const directory = {
    hotelRatePeriodCityNames: vi.fn(async (ids: string[]) =>
      ids.map((id) => ({
        id,
        name: id === 'city-0' ? 'Antalya' : 'Other country city',
      })),
    ),
  };
  const pricing = new PackagePricingService(
    {} as never,
    {} as never,
    {} as never,
    { pricingDeparture: vi.fn(async () => grid.tour) } as never,
    { forTour } as never,
    { paidCostsForOffers: vi.fn(async () => []) } as never,
    directory as never,
  );
  const result = await pricing.tourCostGrid('tour', actor);
  expect(forTour.mock.calls.map((c) => [c[2], c[3], c[5]])).toEqual([
    ['2026-11-01', '2026-11-03', 'city-0'],
    ['2026-11-03', '2026-11-05', 'city-1'],
  ]);
  expect(result.purchaseBatches).toHaveLength(2);
  expect(result.destinationStays?.[1]?.name).toBe('Other country city');
});
it('rejects a hotel from another destination before saving and a changed draft version before publishing', async () => {
  const { service, input, grid, tx } = setup();
  grid.purchaseBatches[1]!.cityId = 'other';
  await expect(service.save(input, actor)).rejects.toThrow();
  expect(tx.packagePricingTourDraft.create).not.toHaveBeenCalled();
  const valid = setup();
  const saved = await valid.service.save(valid.input, actor);
  await expect(
    valid.service.publish(
      saved.id,
      { version: 1, expectedDraftVersion: 2, reason: '' },
      actor,
    ),
  ).rejects.toThrow('تغییر کرده');
});
