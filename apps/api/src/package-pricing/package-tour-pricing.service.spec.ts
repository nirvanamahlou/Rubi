import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { PackagePricingService } from './package-pricing.service';
import { PackageTourPricingService } from './package-tour-pricing.service';
import { Prisma } from '@nora/database';

const actor = { userId: 'sales-user', branchIds: ['branch-a'] } as never;
const grid = {
  version: 1,
  nights: 5,
  missingFlightOfferIds: ['offer-1'],
  tour: {
    id: 'tour-1',
    branchId: 'branch-a',
    startsOn: '2026-10-01',
    endsOn: '2026-10-06',
    remainingCapacity: 10,
    package: { hotelIds: ['hotel-1'] },
  },
  purchaseBatches: [
    {
      id: 'batch-1',
      currencyCode: 'EUR',
      rows: [{ id: 'rate-1', hotelId: 'hotel-1' }],
    },
  ],
};

describe('PackageTourPricingService', () => {
  it('publishes six-night hotel choices with separate EUR and IRR amounts and rereads them', async () => {
    const draft = {
      id: 'draft-1',
      version: 1,
      tourDepartureId: 'tour-1',
      batchId: 'batch-1',
      updatedByUserId: 'another-editor',
      currencyCode: 'EUR',
      adultFlightSale: new Prisma.Decimal('10000000'),
      adultFlightSaleCurrencyCode: 'IRR',
      childFlightSale: new Prisma.Decimal('5000000'),
      childFlightSaleCurrencyCode: 'IRR',
      businessUplift: new Prisma.Decimal('0'),
      businessUpliftCurrencyCode: 'IRR',
      commissionPercent: new Prisma.Decimal('5'),
      familyAdults: 2,
      familyChildren: 1,
      adjustments: [
        {
          hotelRateId: 'rate-1',
          direction: 'increase',
          mode: 'percent',
          value: new Prisma.Decimal('10'),
        },
      ],
    };
    const fullGrid = {
      ...grid,
      nights: 7,
      missingFlightOfferIds: [],
      tour: {
        ...grid.tour,
        version: 1,
        endsOn: '2026-10-08',
        outboundOfferId: 'out',
        returnOfferId: 'back',
        outbound: { cabinClassCode: 'ECONOMY' },
        returning: { cabinClassCode: 'ECONOMY' },
      },
      purchaseBatches: [
        {
          id: 'batch-1',
          currencyCode: 'EUR',
          checkIn: '2026-10-02',
          checkOut: '2026-10-08',
          rows: [
            {
              id: 'rate-1',
              hotelId: 'hotel-1',
              basePerNight: '100',
              currencyCode: 'EUR',
              factors: Object.fromEntries(
                [
                  'single',
                  'double',
                  'triple',
                  'doubleChild',
                  'doubleTwoChildren',
                  'family',
                ].map((code) => [code, '1']),
              ),
              roomRates: [
                {
                  roomTypeId: 'double',
                  roomTypeName: 'دوتخته',
                  factor: '1',
                  maxAdults: 2,
                  maxChildren: 0,
                },
              ],
            },
          ],
        },
      ],
      flightPurchaseCosts: ['out', 'back'].map((offerId) => ({
        offerId,
        costRevisionId: offerId + '-cost',
        adultUnitCost: '4000000',
        childUnitCost: '2000000',
        currencyCode: 'IRR',
      })),
    };
    const create = vi.fn(async ({ data }) => ({
      ...data,
      roomPrices: data.roomPrices.create,
      publishedAt: new Date('2026-09-16T00:00:00Z'),
    }));
    const tx = {
      $queryRaw: vi.fn(),
      packagePricingTourDraft: { findUnique: vi.fn().mockResolvedValue(draft) },
      packagePricingTourPublishedVersion: {
        findFirst: vi.fn().mockResolvedValue(null),
        create,
      },
    };
    const database = {
      client: {
        packagePricingTourDraft: {
          findFirst: vi.fn().mockResolvedValue(draft),
        },
        $transaction: vi.fn(async (run) => run(tx)),
      },
    } as unknown as DatabaseService;
    const pricing = {
      tourCostGrid: vi.fn().mockResolvedValue(fullGrid),
    } as unknown as PackagePricingService;
    const result = await new PackageTourPricingService(
      database,
      pricing,
    ).publish(
      'draft-1',
      { version: 1, expectedDraftVersion: 1, reason: 'review' },
      actor,
    );
    const double = result.roomPrices.find((row) => row.roomCode === 'double')!;
    expect(result.roomPrices).toHaveLength(1);
    expect(double.hotelPurchase).toBe('600');
    expect(double.packageSale).toBeNull();
    expect(double.currencyAmounts).toEqual([
      {
        currencyCode: 'EUR',
        purchase: '600.00',
        sale: '660.00',
        commission: '33.00',
        profit: '27.00',
      },
      {
        currencyCode: 'IRR',
        purchase: '16000000',
        sale: '20000000',
        commission: '1000000',
        profit: '3000000',
      },
    ]);
    expect(result.roomPrices).toHaveLength(1);
    expect(result.familyChildren).toBe(1);
  });
  it('never permits publishing by the last draft editor', async () => {
    const database = {
      client: {
        packagePricingTourDraft: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'draft-1',
            version: 1,
            updatedByUserId: 'sales-user',
            adjustments: [],
          }),
        },
      },
    } as unknown as DatabaseService;
    const pricing = {
      tourCostGrid: vi.fn(),
    } as unknown as PackagePricingService;
    const service = new PackageTourPricingService(database, pricing);
    await expect(
      service.publish(
        'draft-1',
        {
          version: 1,
          expectedDraftVersion: 1,
          reason: 'review',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(pricing.tourCostGrid).not.toHaveBeenCalled();
  });

  it('rejects edits to a hotel rate outside the selected purchase batch', async () => {
    const pricing = {
      tourCostGrid: vi.fn().mockResolvedValue(grid),
    } as unknown as PackagePricingService;
    const service = new PackageTourPricingService(
      {} as DatabaseService,
      pricing,
    );
    await expect(
      service.save(
        {
          version: 1,
          expectedVersion: 0,
          tourDepartureId: 'tour-1',
          batchId: 'batch-1',
          currencyCode: 'EUR',
          adultFlightSale: '250',
          childFlightSale: '150',
          businessUplift: '40',
          commissionPercent: '10',
          adjustments: [
            {
              hotelRateId: 'outside-rate',
              direction: 'increase',
              mode: 'percent',
              value: '12',
            },
          ],
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
