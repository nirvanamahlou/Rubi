import { writeFileSync } from 'node:fs';
import { createElement } from 'react';
import type * as ReactModule from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  values: null as unknown[] | null,
  index: 0,
}));
vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>();
  return {
    ...actual,
    useState: (initial: unknown) => {
      const index = state.index++;
      return actual.useState(
        state.values && index < state.values.length
          ? state.values[index]
          : initial,
      );
    },
  };
});
vi.mock('@/modules/ticket-catalog/api/tours', () => ({ toursApi: {} }));
vi.mock('@/modules/ticket-catalog/api/references', () => ({
  listActiveCurrencyReferences: vi.fn(),
  listReferences: vi.fn(),
}));
import { TicketPricesWorkspace } from './ticket-prices-workspace';
describe('ticket price workspace', () => {
  it('renders unified filters and the pair editor before the common list', () => {
    state.values = null;
    state.index = 0;
    const html = renderToStaticMarkup(createElement(TicketPricesWorkspace));
    for (const text of [
      'قیمت بلیط',
      'مبدأ',
      'مقصد سفر',
      'نوع بلیت',
      'فهرست قیمت‌گذاری بلیت‌ها',
      'قیمت کل رفت‌وبرگشت',
      'نام مقصد فروش',
      'خلاصه قیمت‌گذاری بلیط‌ها',
    ])
      expect(html).toContain(text);
    expect(html.indexOf('round-trip-price-editor')).toBeLessThan(
      html.indexOf('فهرست قیمت‌گذاری بلیت‌ها'),
    );
    expect(html).not.toContain('قیمت‌های رفت‌وبرگشت ثبت‌شده');
  });
  it('renders compact pair and single rows with all target fields, persisted percentages and exact net prices', () => {
    const base = {
      version: 1,
      branchId: 'branch',
      originId: 'tehran',
      destinationId: 'antalya',
      departureAt: '2099-01-01T10:00:00Z',
      arrivalAt: '2099-01-01T13:00:00Z',
      carrierName: 'ایران ایرتور',
      serviceNumber: '4512',
      cabinClassCode: 'ECONOMY',
      totalCapacity: 50,
      remainingCapacity: 49,
      status: 'ACTIVE',
    };
    const offers = [
      {
        ...base,
        id: 'out',
        standaloneSalePrice: {
          amount: '10000000',
          currencyCode: 'IRR',
          revision: 1,
        },
        roundTripSalePrices: [
          {
            returnOfferId: 'back',
            amount: '25000000',
            baseAmount: '25000000',
            currencyCode: 'IRR',
            revision: 1,
          },
        ],
        saleCommissions: [
          {
            returnOfferId: null,
            salePriceTargetId: 'partner',
            revision: 1,
            percent: '3',
            amount: '9700000',
            currencyCode: 'IRR',
          },
          {
            returnOfferId: 'back',
            salePriceTargetId: 'partner',
            revision: 1,
            percent: '4',
            amount: '24000000',
            currencyCode: 'IRR',
          },
        ],
      },
      {
        ...base,
        id: 'back',
        originId: 'antalya',
        destinationId: 'tehran',
        departureAt: '2099-01-08T10:00:00Z',
        serviceNumber: '4513',
        roundTripSalePrices: [],
      },
    ];
    state.values = [
      offers,
      [
        {
          id: 'partner',
          branchId: 'branch',
          name: 'علی‌بابا',
          code: 'PARTNER',
          isActive: true,
          version: 1,
        },
      ],
      '',
      '',
      {
        out: { amount: '10000000', currencyCode: 'IRR' },
        'out:back': { amount: '25000000', currencyCode: 'IRR' },
      },
      {},
      ['IRR', 'EUR'],
      { tehran: 'تهران', antalya: 'آنتالیا' },
      '',
      '',
      '',
      'ALL',
      '',
      '',
      '',
      '',
      { amount: '', currencyCode: 'IRR' },
      false,
      '',
      '',
      '',
    ];
    state.index = 0;
    const html = renderToStaticMarkup(createElement(TicketPricesWorkspace));
    expect(html.match(/<article /g)).toHaveLength(3);
    expect(html.match(/کپی درصد برای این مقصد/g)).toHaveLength(4);
    expect(html).toContain('9,700,000 IRR');
    expect(html).toContain('24,000,000 IRR');
    expect(html).toContain('value="3"');
    expect(html).toContain('value="4"');
    expect(html).toContain('بلیط برگشت');
    expect(html).toContain('پس از ثبت قیمت پایه');
    if (process.env.TICKET_PRICE_VISUAL_QA_PATH)
      writeFileSync(process.env.TICKET_PRICE_VISUAL_QA_PATH, html);
    state.values = null;
  });
});
