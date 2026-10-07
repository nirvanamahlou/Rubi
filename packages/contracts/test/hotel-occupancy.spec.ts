import { describe, expect, it } from 'vitest';
import {
  hotelAgeOn,
  hotelChildrenFit,
  hotelMaximumCombinations,
  quoteHotelOccupancy,
} from '../src/package-pricing/hotel-occupancy';
import type { HotelOccupancyRateV1 } from '../src/package-pricing';
const tariff = (
  adults = 2,
  children = 0,
  amount = '123.4567',
): HotelOccupancyRateV1 => ({
  adults,
  childAges: Array.from({ length: children }, () => ({
    min: 3,
    maxExclusive: 7,
  })),
  amount,
  startsOn: '2026-10-01',
  endsOnExclusive: '2026-11-01',
  currencyCode: 'EUR',
  board: 'BB',
  composition: 'ROOM',
});
const stay = {
  adults: 2,
  childAges: [],
  rooms: 1,
  checkIn: '2026-10-05',
  checkOut: '2026-10-07',
};
describe('exact hotel occupancy and room nightly rates', () => {
  it('preserves high precision source tariffs and rounds only the final total', () =>
    expect(
      quoteHotelOccupancy([tariff(2, 0, '2432.99998')], {
        ...stay,
        checkOut: '2026-10-08',
      }),
    ).toEqual({ amount: '7298.9999', currencyCode: 'EUR' }));
  it('retains every Pareto maximum without inventing their cross-product', () => {
    expect(
      hotelMaximumCombinations([
        tariff(3, 1),
        tariff(2, 2),
        tariff(2, 0),
        tariff(3, 1),
      ]),
    ).toBe('3 AD + 1 CHD / 2 AD + 2 CHD');
    expect(
      quoteHotelOccupancy([tariff(3, 1), tariff(2, 2)], {
        ...stay,
        adults: 3,
        childAges: [4, 5],
      }),
    ).toBeNull();
  });
  it('prices the whole room, all nights, with exact four-decimal amounts', () =>
    expect(quoteHotelOccupancy([tariff()], stay)).toEqual({
      amount: '246.9134',
      currencyCode: 'EUR',
    }));
  it('matches each child age slot independent of order and excludes the seventh birthday', () => {
    expect(
      hotelChildrenFit(
        [6, 1],
        [
          { min: 0, maxExclusive: 2 },
          { min: 3, maxExclusive: 7 },
        ],
      ),
    ).toBe(true);
    expect(hotelChildrenFit([7], [{ min: 3, maxExclusive: 7 }])).toBe(false);
    expect(hotelChildrenFit([NaN], [{ min: 0, maxExclusive: 7 }])).toBe(false);
  });
  it('requires rates for every stay night and allows adjacent seasonal periods', () => {
    const first = { ...tariff(), endsOnExclusive: '2026-10-06' },
      second = { ...tariff(2, 0, '200'), startsOn: '2026-10-06' };
    expect(quoteHotelOccupancy([first], stay)).toBeNull();
    expect(quoteHotelOccupancy([first, second], stay)?.amount).toBe('323.4567');
  });
  it('allocates multiple rooms to actual legal combinations', () =>
    expect(
      quoteHotelOccupancy([tariff(3, 1, '100'), tariff(2, 2, '200')], {
        ...stay,
        adults: 5,
        rooms: 2,
        childAges: [3, 4, 5],
      }),
    ).toEqual({ amount: '600', currencyCode: 'EUR' }));
  it('does not mix boards, currencies or conflicting overlapping rates', () => {
    expect(
      quoteHotelOccupancy([tariff(), { ...tariff(), board: 'HB' }], stay),
    ).toBeNull();
    expect(
      quoteHotelOccupancy(
        [tariff(), { ...tariff(), currencyCode: 'USD' }],
        stay,
      ),
    ).toBeNull();
    expect(
      quoteHotelOccupancy([tariff(), tariff(2, 0, '120')], stay),
    ).toBeNull();
    expect(quoteHotelOccupancy([tariff(), tariff()], stay)?.amount).toBe(
      '246.9134',
    );
  });
  it('rejects normalized nonexistent dates and validates ages at hotel check-in', () => {
    expect(
      quoteHotelOccupancy([tariff()], { ...stay, checkIn: '2026-02-30' }),
    ).toBeNull();
    expect(hotelAgeOn('2020-10-06', '2026-10-05')).toBe(5);
    expect(hotelAgeOn('2020-10-06', '2026-10-06')).toBe(6);
    expect(hotelAgeOn('2020-02-30', '2026-10-06')).toBeNull();
  });
});
