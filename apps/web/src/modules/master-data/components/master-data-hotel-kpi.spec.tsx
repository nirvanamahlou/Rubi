import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MasterAccommodationSummary } from '@nora/contracts';
import { describe, expect, it } from 'vitest';

import { hotelKpiItems } from './master-data-accommodation-workspace';
import { MasterDataKpiGrid } from './master-data-kpi-grid';

function summary(memberHotels: unknown): MasterAccommodationSummary {
  return {
    hotels: {
      total: 24,
      saleable: 18,
      countries: 3,
      cities: 7,
      incomplete: 9,
    },
    chains: {
      total: 5,
      active: 4,
      memberHotels: memberHotels as number,
      incomplete: 1,
    },
    roomTypes: {
      total: 0,
      active: 0,
      standardCapacity: 0,
      pendingDomainApproval: 0,
    },
    mealServices: {
      total: 0,
      active: 0,
      mealPlans: 0,
      needsReview: 0,
    },
    facilities: {
      total: 0,
      active: 0,
      categories: 0,
      missingIcon: 0,
    },
    compositeHotels: {
      total: 0,
      active: 0,
      uniqueMemberHotels: 0,
      needsReview: 0,
    },
  };
}

function renderHotelKpis(memberHotels: unknown, loaded = true) {
  const items = hotelKpiItems(summary(memberHotels), loaded);
  return {
    items,
    html: renderToStaticMarkup(
      createElement(MasterDataKpiGrid, {
        items,
        label: 'شاخص‌های هتل‌ها',
      }),
    ),
  };
}

describe('hotel KPI grid', () => {
  it('renders the real global chain-member total as the fourth of four cards', () => {
    const { items, html } = renderHotelKpis(12);

    expect(items).toHaveLength(4);
    expect(items.map(({ label }) => label)).toEqual([
      'کل هتل‌ها',
      'فروش‌پذیر',
      'کشورها / شهرها',
      'هتل‌های زنجیره‌ای',
    ]);
    expect(html).toContain('هتل‌های زنجیره‌ای');
    expect(html).toContain('۱۲');
    expect(html).toContain('در کل اطلاعات پایه');
    expect(html).not.toContain('نیازمند تکمیل');
  });

  it('renders a canonical zero without treating it as unknown', () => {
    const { items, html } = renderHotelKpis(0);
    expect(items[3]?.value).toBe(0);
    expect(html).toContain('>۰<');
  });

  it.each([
    ['loading', 8, false],
    ['null', null, true],
    ['missing', undefined, true],
    ['negative', -1, true],
    ['fractional', 1.5, true],
    ['string', '12', true],
    ['NaN', Number.NaN, true],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1, true],
  ] as const)(
    'renders an unavailable marker for %s data',
    (_, value, loaded) => {
      const { items, html } = renderHotelKpis(value, loaded);
      expect(items[3]?.value).toBe('—');
      expect(html).toContain('>—<');
      expect(html).not.toContain('>۰<');
    },
  );
});
