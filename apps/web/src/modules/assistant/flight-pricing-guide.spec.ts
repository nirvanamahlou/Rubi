import type { TicketOfferV1 } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import { loadTicketPricingOffers } from '../sales/api/ticket-pricing-offers';
import {
  TicketCatalogRequestError,
  toursApi,
} from '../ticket-catalog/api/tours';
import {
  readFlightPricing,
  resolveFlightPricingQuestion,
} from './flight-pricing-guide';

vi.mock('../sales/api/ticket-pricing-offers', () => ({
  loadTicketPricingOffers: vi.fn(),
}));
const signal = new AbortController().signal;
const offer = {
  id: 'outbound',
  branchId: 'branch',
  originId: 'origin',
  destinationId: 'destination',
  departureAt: '2026-11-20T21:00:00Z',
  arrivalAt: '2026-11-20T23:00:00Z',
  serviceNumber: '712',
  carrierName: 'Example',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 10,
  status: 'ACTIVE',
  baseStandaloneSalePrice: {
    amount: '100',
    currencyCode: 'IRR',
    revision: 1,
    childAmount: '0',
  },
} as TicketOfferV1;
function intent(question: string) {
  const result = resolveFlightPricingQuestion(question, true);
  if (result?.kind !== 'read') throw new Error('Expected a price lookup');
  return result;
}
const load = vi.mocked(loadTicketPricingOffers);

describe('Flight pricing guidance', () => {
  it.each([
    ['دریافت مرجع اطلاعات پایه ممکن نشد', 'overview'],
    ['فیلتر مبدأ کجاست', 'filters'],
    ['چرا قیمت پایه ثبت نمی شه', 'age'],
    ['چرا برگشت تو لیست نیست', 'pair'],
    ['ظرفیت پله ها چطور حساب میشه', 'tiers'],
    ['کپی درصد روی کدوم بلیت هاست', 'targets'],
    ['خروجی اکسل کجاست', 'export'],
    ['قیمت ثبت شده چرا روی سایت نیست', 'publish'],
    ['خطای تعارض نسخه بعد از ذخیره', 'errors'],
  ])('routes %s and remembers the topic', (text, id) => {
    expect(resolveFlightPricingQuestion(text, true)).toMatchObject({
      kind: 'guide',
      topic: { id },
    });
    expect(resolveFlightPricingQuestion('بعدش چی؟', false, id)).toMatchObject({
      kind: 'guide',
      topic: { id },
    });
  });
  it('preserves adjacent domains', () => {
    for (const text of [
      'مبلغ قرارداد چقدر است؟',
      'خرید صندلی را کجا ثبت کنم؟',
      'نرخ مرجع ارز کجاست؟',
    ])
      expect(resolveFlightPricingQuestion(text, true)).toBeUndefined();
  });
  it('uses Tehran dates, distinguishes cabins, and honors zero child fare', async () => {
    load.mockResolvedValue({
      version: 1,
      data: [offer, { ...offer, id: 'business', cabinClassCode: 'BUSINESS' }],
    });
    expect(
      await readFlightPricing(intent('قیمت پرواز ۷۱۲ چقدر است'), signal),
    ).toContain('چند ردیف');
    const question = intent('قیمت کودک پرواز ۷۱۲ ۱۴۰۵/۰۸/۳۰ اکونومی چقدر است');
    expect(await readFlightPricing(question, signal)).toContain(' · 0 · IRR');
    expect(load).toHaveBeenCalledWith(signal);
    expect(
      await readFlightPricing(
        intent('قیمت پرواز ۷۱۲ 2026-11-20 اکونومی چقدر است'),
        signal,
      ),
    ).toContain('پیدا نشد');
  });
  it('requires a priced pair and rejects an inactive sale target', async () => {
    load.mockResolvedValue({ version: 1, data: [offer] });
    expect(
      await readFlightPricing(intent('قیمت پرواز ۷۱۲ جفت چقدر است'), signal),
    ).toContain('شماره پرواز');
    using targetSpy = vi.spyOn(toursApi, 'salePriceTargets').mockResolvedValue({
      version: 1,
      data: [
        {
          id: 'target',
          branchId: 'branch',
          name: 'site',
          code: 'web',
          version: 1,
          isActive: false,
        },
      ],
    });
    expect(
      await readFlightPricing(
        intent('قیمت پرواز ۷۱۲ مقصد فروش web چقدر است'),
        signal,
      ),
    ).toContain('فعال و یکتا');
    expect(targetSpy).toHaveBeenCalledWith(signal);
  });
  it.each([
    [401, 'نشست'],
    [403, 'مجوز'],
    [500, 'ناموفق'],
  ])('reports HTTP %s without provider details', async (status, expected) => {
    load.mockRejectedValue(new TicketCatalogRequestError('private', status));
    expect(
      await readFlightPricing(intent('قیمت پرواز ۷۱۲ چقدر است'), signal),
    ).toContain(expected);
  });
});

it('reads the total for the exact pair and blocks a hidden destination', async () => {
  const returning = {
    ...offer,
    id: 'return',
    serviceNumber: '713',
    departureAt: '2026-11-24T09:00:00Z',
  };
  const paired = {
    ...offer,
    baseRoundTripSalePrices: [
      {
        returnOfferId: returning.id,
        amount: '250',
        revision: 1,
        currencyCode: 'IRR',
      },
    ],
    saleCommissions: [
      {
        returnOfferId: returning.id,
        salePriceTargetId: 'target',
        amount: '0',
        revision: 1,
        currencyCode: 'IRR',
        percent: '100',
        isHidden: true,
      },
    ],
  };
  load.mockResolvedValue({ version: 1, data: [paired, returning] });
  const question =
    'قیمت پرواز ۷۱۲ 2026-11-21 جفت برگشت ۷۱۳ 2026-11-24 اکونومی چقدر است';
  expect(await readFlightPricing(intent(question), signal)).toContain(
    ' · 250 · IRR',
  );
  using targetSpy = vi.spyOn(toursApi, 'salePriceTargets').mockResolvedValue({
    version: 1,
    data: [
      {
        id: 'target',
        branchId: 'branch',
        name: 'site',
        code: 'web',
        version: 1,
        isActive: true,
      },
    ],
  });
  expect(
    await readFlightPricing(intent(question + ' مقصد فروش web'), signal),
  ).toContain('غیرفعال');
  expect(targetSpy).toHaveBeenCalledWith(signal);
});
