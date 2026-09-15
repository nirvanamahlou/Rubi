import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseService } from '../database/database.service';
import type { PackagePricingService } from './package-pricing.service';
import { PackageTourPricingService } from './package-tour-pricing.service';

const actor = { userId: 'sales-user', branchIds: ['branch-a'] } as never;
const grid = {
  version: 1, nights: 5, missingFlightOfferIds: ['offer-1'],
  tour: { id: 'tour-1', branchId: 'branch-a', startsOn: '2026-10-01',
    endsOn: '2026-10-06', remainingCapacity: 10,
    package: { hotelIds: ['hotel-1'] } },
  purchaseBatches: [{ id: 'batch-1', currencyCode: 'EUR',
    rows: [{ id: 'rate-1', hotelId: 'hotel-1' }] }],
};

describe('PackageTourPricingService', () => {
  it('never permits publishing by the last draft editor', async () => {
    const database = { client: { packagePricingTourDraft: {
      findFirst: vi.fn().mockResolvedValue({ id: 'draft-1', version: 1,
        updatedByUserId: 'sales-user', adjustments: [] }),
    } } } as unknown as DatabaseService;
    const pricing = { tourCostGrid: vi.fn() } as unknown as PackagePricingService;
    const service = new PackageTourPricingService(database, pricing);
    await expect(service.publish('draft-1', {
      version: 1, expectedDraftVersion: 1, reason: 'review',
    }, actor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(pricing.tourCostGrid).not.toHaveBeenCalled();
  });

  it('rejects edits to a hotel rate outside the selected purchase batch', async () => {
    const pricing = { tourCostGrid: vi.fn().mockResolvedValue(grid) } as unknown as PackagePricingService;
    const service = new PackageTourPricingService({} as DatabaseService, pricing);
    await expect(service.save({ version: 1, expectedVersion: 0,
      tourDepartureId: 'tour-1', batchId: 'batch-1', currencyCode: 'EUR',
      adultFlightSale: '250', childFlightSale: '150', businessUplift: '40',
      commissionPercent: '10', adjustments: [{ hotelRateId: 'outside-rate',
        direction: 'increase', mode: 'percent', value: '12' }],
    }, actor)).rejects.toBeInstanceOf(BadRequestException);
  });
});
