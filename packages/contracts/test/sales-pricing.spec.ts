import { describe, expect, it } from 'vitest';
import {
  hotelNights,
  moneyUnits,
  resolveSalesPrice,
  servicePriceComponents,
  type SalesServicePricingV1,
} from '../src/sales/pricing';
const price: SalesServicePricingV1 = {
  version: 1,
  currencyCode: 'IRR',
  daySale: { basis: 'NIGHT', amount: '2000000' },
  agreed: { basis: 'TOTAL', amount: '5500000' },
};
describe('versioned hotel sale pricing', () => {
  it('computes exclusive UTC calendar nights, independent of timezone/DST', () => {
    expect(hotelNights('2026-03-20', '2026-03-23')).toBe(3);
    expect(hotelNights('2028-02-28', '2028-03-01')).toBe(2);
  });
  it.each([
    ['2026-02-30', '2026-03-04'],
    ['2026-03-20', '2026-03-20'],
    ['2026-03-21', '2026-03-20'],
    ['', '2026-03-20'],
  ])('rejects invalid stay %s %s', (a, b) =>
    expect(() => hotelNights(a, b)).toThrow(),
  );
  it('multiplies nightly price, keeps entered total exact and rounds only the display', () => {
    expect(resolveSalesPrice(price, 3, true)).toMatchObject({
      dayTotal: '6000000',
      agreedTotal: '5500000',
      discount: '500000',
      agreedNight: '1833333.3333',
      agreedNightApproximate: true,
    });
    expect(price.agreed.amount).toBe('5500000');
  });
  it('recomputes nightly-input totals for date changes but never multiplies an entered total', () => {
    expect(resolveSalesPrice(price, 4, true)).toMatchObject({
      dayTotal: '8000000',
      agreedTotal: '5500000',
    });
  });
  it('keeps precision beyond JavaScript safe integers', () => {
    const value = {
      ...price,
      daySale: { basis: 'TOTAL' as const, amount: '9007199254740993.0001' },
      agreed: { basis: 'TOTAL' as const, amount: '9007199254740993' },
    };
    expect(resolveSalesPrice(value, 3, true).discount).toBe('0.0001');
  });
  it.each(['0', '-1', '1e4', '1,000', '1.12345', '9999999999999999999'])(
    'rejects invalid sale amount %s',
    (amount) =>
      expect(() =>
        resolveSalesPrice(
          { ...price, agreed: { basis: 'TOTAL', amount } },
          3,
          true,
        ),
      ).toThrow(),
  );
  it('rejects NIGHT for non-hotel and malformed currencies', () => {
    expect(() => resolveSalesPrice(price, 1, false)).toThrow();
    expect(() =>
      resolveSalesPrice({ ...price, currencyCode: 'irr' }, 3, true),
    ).toThrow();
  });
  it('derives billing components whose net equals agreed, without a manual discount choice', () => {
    const parts = servicePriceComponents(
      [
        {
          clientKey: 'hotel',
          kind: 'HOTEL',
          titleSnapshot: 'هتل',
          pricing: [price],
        },
      ],
      { checkInDate: '2026-09-10', checkOutDate: '2026-09-13' },
    )!;
    expect(parts.map((p) => p.type)).toEqual(['BASE', 'DISCOUNT']);
    expect(moneyUnits(parts[0]!.amount) - moneyUnits(parts[1]!.amount)).toBe(
      moneyUnits('5500000'),
    );
  });
  it('rejects missing service prices/duplicate currencies and preserves legacy requests', () => {
    expect(
      servicePriceComponents([
        { clientKey: 'hotel', kind: 'HOTEL', titleSnapshot: 'هتل' },
      ]),
    ).toBeNull();
    expect(() =>
      servicePriceComponents([
        {
          clientKey: 'hotel',
          kind: 'HOTEL',
          titleSnapshot: 'هتل',
          pricing: [],
        },
      ]),
    ).toThrow();
    expect(() =>
      servicePriceComponents(
        [
          {
            clientKey: 'hotel',
            kind: 'HOTEL',
            titleSnapshot: 'هتل',
            pricing: [price, price],
          },
        ],
        { checkInDate: '2026-09-10', checkOutDate: '2026-09-13' },
      ),
    ).toThrow();
  });
});
