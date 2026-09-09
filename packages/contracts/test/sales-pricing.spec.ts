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
  const transfer = {
    clientKey: 'transfer-return',
    kind: 'TRANSFER' as const,
    titleSnapshot: 'ترانسفر برگشت',
    metadata: { direction: 'RETURN', includedWithoutCharge: true },
  };
  const ticketPrice = {
    ...price,
    daySale: { basis: 'TOTAL' as const, amount: '6000000' },
  };
  it('keeps included transfers out of billing alongside priced services', () => {
    const flight = {
      clientKey: 'flight',
      kind: 'FLIGHT' as const,
      titleSnapshot: 'پرواز',
      pricing: [ticketPrice],
    };
    expect(servicePriceComponents([flight, transfer])).toEqual(
      servicePriceComponents([flight]),
    );
    expect(servicePriceComponents([transfer])).toEqual([]);
  });
  it('rejects prices on included transfers and inclusion of a chargeable kind', () => {
    expect(() =>
      servicePriceComponents([{ ...transfer, pricing: [ticketPrice] }]),
    ).toThrow('نباید قیمت');
    expect(() =>
      servicePriceComponents([{ ...transfer, kind: 'HOTEL' }]),
    ).toThrow();
  });
  it('preserves historical unmarked transfer billing', () => {
    expect(
      servicePriceComponents([
        { ...transfer, metadata: { direction: 'RETURN' } },
      ]),
    ).toBeNull();
    expect(
      servicePriceComponents([
        {
          ...transfer,
          metadata: { direction: 'RETURN' },
          pricing: [ticketPrice],
        },
      ]),
    ).toHaveLength(2);
  });
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
