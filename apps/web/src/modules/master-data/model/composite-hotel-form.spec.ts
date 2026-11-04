import { describe, expect, it } from 'vitest';
import {
  compositeHotelRows,
  compositeHotelValues,
} from './composite-hotel-form';
import type { MasterDataRecord } from '@nora/contracts';

describe('ordered composite hotel form', () => {
  it('starts blank and keeps actual city/hotel pairs in member order', () => {
    expect(compositeHotelRows()).toEqual([
      { key: 'initial', cityId: '', hotelId: '' },
    ]);
    const rows = compositeHotelRows({
      name: 'Trip',
      attributes: {
        memberHotels: JSON.stringify([
          { hotelId: 'h2', cityId: 'c2', hotelName: 'HOTEL, TWO' },
          { hotelId: 'h1', cityId: 'c1', hotelName: 'HOTEL ONE' },
        ]),
      },
    } as unknown as MasterDataRecord);
    expect(compositeHotelValues(' Trip ', rows)).toEqual({
      name: 'Trip',
      cityId: 'c2',
      memberHotelIds: 'h2,h1',
    });
  });
  it('rejects empty titles, incomplete rows, duplicate hotels and oversized lists', () => {
    const row = { key: 'a', cityId: 'city', hotelId: 'hotel' };
    expect(() => compositeHotelValues('', [row])).toThrow();
    expect(() =>
      compositeHotelValues('Trip', [{ ...row, cityId: '' }]),
    ).toThrow();
    expect(() =>
      compositeHotelValues('Trip', [row, { ...row, key: 'b' }]),
    ).toThrow();
    expect(() =>
      compositeHotelValues(
        'Trip',
        Array.from({ length: 51 }, (_, i) => ({ ...row, hotelId: `${i}` })),
      ),
    ).toThrow();
  });
});
