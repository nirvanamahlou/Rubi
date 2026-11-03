import { describe, expect, it, vi } from 'vitest';
import { PackageTourPricingService } from './package-tour-pricing.service';
import {
  packageRoomCode,
  type AuthenticatedActor,
  type SalesContractCreateRequest,
} from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import type { PackagePricingService } from './package-pricing.service';
const code = packageRoomCode({
  roomTypeId: 'room',
  adults: 2,
  childAges: [],
  board: 'BB',
});
const actor = {
  userId: 'user',
  permissions: ['sales.contracts.create'],
  branchIds: ['branch'],
} as AuthenticatedActor;
function fixture() {
  const findMany = vi.fn().mockResolvedValue([
    {
      batchId: 'batch',
      publications: [
        {
          id: 'pub',
          roomPrices: [
            {
              hotelRateId: 'rate',
              roomTypeName: 'Room',
              roomCode: code,
              hotelPurchase: 'secret-purchase',
              netProfit: 'secret-profit',
              currencyAmounts: [
                {
                  currencyCode: 'EUR',
                  sale: '123.45',
                  purchase: 'secret',
                  profit: 'secret',
                },
              ],
            },
          ],
        },
      ],
    },
  ]);
  const tourCostGrid = vi.fn().mockResolvedValue({
    tour: {
      branchId: 'branch',
      version: 3,
      startsOn: '2026-10-01',
      endsOn: '2026-10-03',
    },
    purchaseBatches: [
      {
        id: 'batch',
        rows: [{ id: 'rate', hotelId: 'hotel', hotelName: 'Hotel' }],
      },
    ],
  });
  return {
    service: new PackageTourPricingService(
      {
        client: { packagePricingTourDraft: { findMany } },
      } as unknown as DatabaseService,
      { tourCostGrid } as unknown as PackagePricingService,
    ),
    findMany,
    tourCostGrid,
  };
}
describe('published package sale projection', () => {
  it('adds published airfare once at contract time, keeping hotel rows and historical combined prices intact', async () => {
    const { service, findMany, tourCostGrid } = fixture();
    const rows = await findMany();
    const publication = rows[0].publications[0];
    const grid = await tourCostGrid();
    Object.assign(grid.tour, { outbound: { cabinClassCode: 'BUSINESS' } });
    const fields = [
      ['adultFlight', '100', 'IRR', 'fixed'],
      ['childFlight', '50', 'IRR', 'fixed'],
      ['infantFlight', '10', 'IRR', 'fixed'],
      ['business', '20', 'EUR', 'fixed'],
      ['commission', '10', 'IRR', 'percent'],
      ['custom', '999', 'EUR', 'fixed'],
    ].map(([kind, amount, currencyCode, mode]) => ({
      id: kind,
      title: kind,
      kind,
      amount,
      currencyCode,
      mode,
    }));
    Object.assign(publication, { priceFields: fields, currencyCode: 'EUR' });
    const price = publication.roomPrices[0];
    const childAges = [
      { min: 0, maxExclusive: 2 },
      { min: 2, maxExclusive: 6 },
      { min: 12, maxExclusive: 15 },
    ];
    price.roomCode = packageRoomCode({
      roomTypeId: 'room',
      adults: 2,
      childAges,
      board: 'BB',
    });
    // Absence of the per-row marker preserves the historical combined total.
    expect((await service.saleCatalog('tour', actor)).data[0]?.prices).toEqual([
      { currencyCode: 'EUR', amount: '123.45' },
    ]);
    Object.assign(price.currencyAmounts[0], { priceBasis: 'HOTEL_ONLY' });
    const expected = [
      { currencyCode: 'EUR', amount: '183.45' },
      { currencyCode: 'IRR', amount: '360' },
    ];
    const result = await service.saleCatalog('tour', actor);
    expect(result.data[0]?.prices).toEqual(expected);
    expect(price.currencyAmounts[0].sale).toBe('123.45');
    const request = {
      services: [
        {
          metadata: {
            tourDepartureId: 'tour',
            packagePublishedSale: JSON.stringify({
              tourDepartureId: 'tour',
              items: [{ publicationId: 'pub', roomCode: price.roomCode }],
              prices: expected,
            }),
          },
        },
      ],
      hotelSelection: {
        hotelId: 'hotel',
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-03',
        rooms: [{ roomTypeId: 'room', adults: 2, childAges: [1, 5, 13] }],
      },
      priceComponents: expected.map((p) => ({
        type: 'BASE',
        title: 'Published',
        ...p,
      })),
    } as unknown as SalesContractCreateRequest;
    await expect(service.validateContractSale(request, actor)).resolves.toBe(
      'hotel',
    );
    request.priceComponents![1]!.amount = '350';
    await expect(service.validateContractSale(request, actor)).rejects.toThrow(
      'قیمت فروش معتبر نیست.',
    );
  });
  it('requires sales permission before reading any prices and delegates branch scope to the owner', async () => {
    const { service, findMany, tourCostGrid } = fixture();
    await expect(
      service.saleCatalog('tour', { ...actor, permissions: [] }),
    ).rejects.toThrow();
    expect(findMany).not.toHaveBeenCalled();
    expect(tourCostGrid).not.toHaveBeenCalled();
    const result = await service.saleCatalog('tour', actor);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(result.data[0]?.prices).toEqual([
      { currencyCode: 'EUR', amount: '123.45' },
    ]);
    expect(findMany.mock.calls[0]?.[0].where.branchId).toBe('branch');
    expect(
      findMany.mock.calls[0]?.[0].include.publications.where.tourVersion,
    ).toBe(3);
  });
  it('checks publication, exact room and canonical totals before a contract can consume the snapshot', async () => {
    const { service } = fixture();
    const quote = {
      tourDepartureId: 'tour',
      items: [{ publicationId: 'pub', roomCode: code }],
      prices: [{ currencyCode: 'EUR', amount: '123.45' }],
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
        hotelId: 'hotel',
        checkInDate: '2026-10-01',
        checkOutDate: '2026-10-03',
        rooms: [{ roomTypeId: 'room', adults: 2, childAges: [] }],
      },
    } as unknown as SalesContractCreateRequest;
    await expect(service.validateContractSale(request, actor)).resolves.toBe(
      'hotel',
    );
    const discounted = {
      ...request,
      priceComponents: [
        {
          type: 'BASE' as const,
          title: 'Published',
          currencyCode: 'EUR',
          amount: '123.45',
        },
        {
          type: 'DISCOUNT' as const,
          title: 'Discount',
          currencyCode: 'EUR',
          amount: '10',
        },
      ],
    };
    await expect(service.validateContractSale(discounted, actor)).resolves.toBe(
      'hotel',
    );
    await expect(
      service.validateContractSale(
        {
          ...discounted,
          priceComponents: [
            { ...discounted.priceComponents[0]!, amount: '999.99' },
            discounted.priceComponents[1]!,
          ],
        },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      service.saleCatalog('tour', actor, 'other-branch'),
    ).rejects.toThrow();
    quote.prices[0]!.amount = '999.99';
    request.services[0]!.metadata = {
      ...request.services[0]!.metadata,
      packagePublishedSale: JSON.stringify(quote),
    };
    await expect(
      service.validateContractSale(request, actor),
    ).rejects.toThrow();
    quote.prices[0]!.amount = '123.45';
    quote.items[0]!.publicationId = 'other';
    request.services[0]!.metadata = {
      ...request.services[0]!.metadata,
      packagePublishedSale: JSON.stringify(quote),
    };
    await expect(
      service.validateContractSale(request, actor),
    ).rejects.toThrow();
  });
});

it('requires a canonical quote for a published tour but retains legacy unpriced tours', async () => {
  const { service, findMany } = fixture();
  const request = {
    services: [{ metadata: { tourDepartureId: 'tour' } }],
  } as unknown as SalesContractCreateRequest;
  await expect(
    service.assertContractSale(request, actor, 'branch'),
  ).rejects.toThrow();
  findMany.mockResolvedValue([]);
  await expect(
    service.assertContractSale(request, actor, 'branch'),
  ).resolves.toBeUndefined();
});

it('rejects manual published base price increases without a discount and excessive discounts', () => {
  const { service } = fixture();
  for (const priceComponents of [
    [{ type: 'BASE', currencyCode: 'EUR', amount: '124', title: 'Base' }],
    [
      { type: 'BASE', currencyCode: 'EUR', amount: '123.45', title: 'Base' },
      {
        type: 'DISCOUNT',
        currencyCode: 'EUR',
        amount: '124',
        title: 'Discount',
      },
    ],
  ])
    expect(() =>
      service.validateContractAmounts(
        { services: [], priceComponents } as never,
        [{ currencyCode: 'EUR', amount: '123.45' }],
      ),
    ).toThrow();
});

it.each(['PAUSED', 'DELETED'])(
  'does not offer published prices for a %s period',
  async (status) => {
    const { service, findMany, tourCostGrid } = fixture();
    const grid = await tourCostGrid();
    tourCostGrid.mockResolvedValue({ ...grid, tour: { ...grid.tour, status } });
    await expect(service.saleCatalog('tour', actor, 'branch')).resolves.toEqual(
      { data: [] },
    );
    expect(findMany).not.toHaveBeenCalled();
  },
);
