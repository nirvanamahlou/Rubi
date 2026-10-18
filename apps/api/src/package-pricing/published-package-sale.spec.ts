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
