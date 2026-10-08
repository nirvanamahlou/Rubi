import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { PackagePricingService } from './package-pricing.service';
import { PackageTourPricingService } from './package-tour-pricing.service';
import { Prisma } from '@nora/database';
import { tourPriceFields } from '@nora/contracts';

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
  it('uses six travel nights within a month-long independent hotel rate window', async () => {
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
    const priceFields = [
      ...tourPriceFields({
        adultFlightSale: '10000000',
        childFlightSale: '5000000',
        commissionPercent: '5',
      }),
      {
        id: 'visa',
        title: 'Visa',
        kind: 'custom' as const,
        amount: '12.50',
        currencyCode: 'GBP',
        mode: 'fixed' as const,
      },
    ];
    Object.assign(draft, { priceFields });
    const fullGrid = {
      ...grid,
      nights: 6,
      missingFlightOfferIds: [],
      tour: {
        ...grid.tour,
        version: 1,
        startsOn: '2026-10-02',
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
          checkIn: '2026-10-01',
          checkOut: '2026-11-01',
          method: 'STAY',
          rows: [
            {
              id: 'rate-1',
              hotelId: 'hotel-1',
              basePerNight: '100',
              currencyCode: 'EUR',
              factors: { double: '1' },
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
        currencyCode: 'GBP',
        purchase: '0.00',
        sale: '12.50',
        commission: '0.63',
        profit: '11.87',
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
    expect(result.priceFields).toEqual(priceFields);
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

const saveInput = {
  version: 1 as const,
  expectedVersion: 0,
  tourDepartureId: 'tour-1',
  batchId: 'batch-1',
  currencyCode: 'EUR',
  adultFlightSale: '250',
  childFlightSale: '150',
  businessUplift: '40',
  commissionPercent: '10',
  adjustments: [],
};
it('persists dynamic fields, canonicalizes deleted defaults, and reads them back without resurrection', async () => {
  let stored: Record<string, unknown> | null = null;
  const create = vi.fn(async ({ data }) => {
    stored = { ...data, version: 1, adjustments: [], updatedAt: new Date() };
    return stored;
  });
  const update = vi.fn(async ({ data }) => {
    stored = { ...stored, ...data, version: Number(stored?.version ?? 0) + 1 };
    return stored;
  });
  const tx = {
    $queryRaw: vi.fn(),
    packagePricingTourDraft: {
      findUnique: vi.fn(async () => stored),
      create,
      update,
      findUniqueOrThrow: vi.fn(async () => stored),
    },
    packagePricingTourAdjustment: { deleteMany: vi.fn() },
  };
  const database = {
    client: {
      $transaction: vi.fn(async (run) => run(tx)),
      packagePricingTourDraft: { findFirst: vi.fn(async () => stored) },
    },
  } as unknown as DatabaseService;
  const pricing = {
    tourCostGrid: vi.fn().mockResolvedValue(grid),
  } as unknown as PackagePricingService;
  const service = new PackageTourPricingService(database, pricing);
  const priceFields = [
    {
      id: 'custom',
      title: 'Visa',
      kind: 'custom' as const,
      amount: '12.50',
      currencyCode: 'GBP',
      mode: 'fixed' as const,
    },
  ];
  const saved = await service.save({ ...saveInput, priceFields }, actor);
  expect(saved.priceFields).toEqual(priceFields);
  expect(saved.adultFlightSale).toBe('0');
  expect(saved.commissionPercent).toBe('0');
  expect((await service.get('tour-1', 'batch-1', actor))?.priceFields).toEqual(
    priceFields,
  );
  const legacySave = await service.save(
    { ...saveInput, expectedVersion: 1 },
    actor,
  );
  expect(legacySave.priceFields).toEqual(priceFields);
  expect(legacySave.adultFlightSale).toBe('0');
  const empty = await service.save(
    { ...saveInput, expectedVersion: 2, priceFields: [] },
    actor,
  );
  expect(empty.priceFields).toEqual([]);
  expect(tourPriceFields(empty)).toEqual([]);
});
it('rejects malformed dynamic fields before source or persistence access', async () => {
  const pricing = { tourCostGrid: vi.fn() } as unknown as PackagePricingService;
  const service = new PackageTourPricingService({} as DatabaseService, pricing);
  await expect(
    service.save(
      {
        ...saveInput,
        priceFields: [
          {
            id: 'bad',
            kind: 'custom',
            title: 'Visa',
            amount: '-5',
            currencyCode: 'GBP',
            mode: 'fixed',
          },
        ],
      },
      actor,
    ),
  ).rejects.toBeInstanceOf(BadRequestException);
  expect(pricing.tourCostGrid).not.toHaveBeenCalled();
});
