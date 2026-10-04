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
import {
  TicketPricesWorkspace,
  clampTierSeatCount,
} from './ticket-prices-workspace';
describe('ticket price workspace', () => {
  it('renders unified filters and the pair editor before the common list', () => {
    state.values = null;
    state.index = 0;
    const html = renderToStaticMarkup(createElement(TicketPricesWorkspace));
    for (const text of [
      'قیمت بلیط',
      'کمیسیون ۱۰۰٪ به معنی عدم نمایش است',
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
  it('renders both cabin prices and their own capacities below the same flight', () => {
    const base = {
      id: 'economy',
      branchId: 'branch',
      originId: 'a',
      destinationId: 'b',
      departureAt: '2099-01-01T10:00:00Z',
      arrivalAt: '2099-01-01T12:00:00Z',
      carrierName: 'Air',
      serviceNumber: '12',
      cabinClassCode: 'ECONOMY',
      totalCapacity: 20,
      remainingCapacity: 20,
      status: 'ACTIVE',
      version: 1,
      standaloneSalePrice: { amount: '100', currencyCode: 'IRR', revision: 1 },
    };
    const business = {
      ...base,
      id: 'business',
      cabinClassCode: 'BUSINESS',
      totalCapacity: 5,
      remainingCapacity: 5,
      standaloneSalePrice: { amount: '300', currencyCode: 'IRR', revision: 1 },
    };
    state.values = [
      [business, base],
      [],
      '',
      '',
      {},
      {},
      ['IRR'],
      { a: 'Origin', b: 'Destination' },
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
      false,
      '',
      '',
      '',
    ];
    state.index = 0;
    const html = renderToStaticMarkup(createElement(TicketPricesWorkspace));
    const articles = html.match(/<article[\s\S]*?<\/article>/g)!;
    expect(articles).toHaveLength(2);
    expect(articles[0]).toContain('اکونومی');
    expect(articles[0]).toContain('۲۰');
    expect(articles[0]).toContain('100 IRR');
    expect(articles[1]).toContain('بیزینس');
    expect(articles[1]).toContain('۵');
    expect(articles[1]).toContain('300 IRR');
    state.values = null;
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
        totalCapacity: 45,
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
        out: {
          amount: '10000000',
          currencyCode: 'IRR',
          tiers: [{ seatCount: 50, amount: '10000000' }],
        },
        'out:back': {
          amount: '25000000',
          currencyCode: 'IRR',
          tiers: [
            { seatCount: 15, amount: '25000000' },
            { seatCount: 30, amount: '26000000' },
          ],
        },
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
    expect(html).toContain('max="15"');
    expect(html).toContain('max="30"');
    expect(html).toContain('ظرفیت تکمیل شده');
    expect(
      clampTierSeatCount(
        '46',
        [
          { seatCount: 15, amount: '1' },
          { seatCount: 30, amount: '2' },
        ],
        0,
        45,
      ),
    ).toBe(15);
    if (process.env.TICKET_PRICE_VISUAL_QA_PATH)
      writeFileSync(process.env.TICKET_PRICE_VISUAL_QA_PATH, html);
    const firstOffer = offers[0];
    if (firstOffer && 'saleCommissions' in firstOffer)
      firstOffer.saleCommissions.forEach((rule) => {
        rule.percent = '100';
        rule.amount = '0';
      });
    state.index = 0;
    const hiddenHtml = renderToStaticMarkup(
      createElement(TicketPricesWorkspace),
    );
    expect(hiddenHtml.match(/>عدم نمایش</g)).toHaveLength(2);
    expect(hiddenHtml).not.toContain('>0 IRR<');
    state.values = null;
  });
});
