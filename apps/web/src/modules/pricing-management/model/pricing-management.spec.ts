import { describe, expect, it } from 'vitest';
import {
  applyPreviewPrices,
  bannerItems,
  filterDailyPrices,
  pricingPreviewItems,
  validateDailyPrice,
} from './pricing-management';

describe('daily sales price management', () => {
  it('accepts positive decimal prices and keeps IRR integer-only', () => {
    expect(validateDailyPrice(pricingPreviewItems[0]!)).toBeNull();
    expect(
      validateDailyPrice({ ...pricingPreviewItems[0]!, draftPrice: '1.5' }),
    ).toContain('ریالی');
    expect(
      validateDailyPrice({ ...pricingPreviewItems[0]!, draftPrice: '-1' }),
    ).toContain('مثبت');
  });

  it('rejects products outside company-owned tour and ticket inventory', () => {
    expect(
      validateDailyPrice({
        ...pricingPreviewItems[0]!,
        ownInventory: false,
      }),
    ).toContain('متعلق به شرکت');
  });

  it('applies only changed preview rows and increments their version', () => {
    const changed = {
      ...pricingPreviewItems[0]!,
      draftPrice: '490000000',
    };
    const result = applyPreviewPrices([changed, pricingPreviewItems[1]!]);
    expect(result[0]).toMatchObject({
      currentPrice: '490000000',
      version: 2,
    });
    expect(result[1]).toBe(pricingPreviewItems[1]);
  });

  it('filters by day, type and searchable product identity', () => {
    expect(
      filterDailyPrices(pricingPreviewItems, 'استانبول', 'OWN_TICKET', '2026-09-12'),
    ).toHaveLength(1);
    expect(
      filterDailyPrices(pricingPreviewItems, '', 'TOUR', '2026-09-13'),
    ).toEqual([]);
  });

  it('limits the banner to selected rows', () => {
    expect(bannerItems(pricingPreviewItems).map((item) => item.id)).toEqual([
      'preview-tour-antalya-001',
      'preview-ticket-ist-001',
    ]);
  });
});
