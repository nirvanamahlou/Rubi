import { describe, expect, it } from 'vitest';
import { blankRows, multiply, nights } from './workspace';

describe('hotel rate grid helpers', () => {
  it('calculates nights and derived rates without floating-point money math', () => {
    expect(nights('2026-10-20', '2026-10-24')).toBe(4);
    expect(nights('2026-02-30', '2026-03-03')).toBe(0);
    expect(multiply('125.5000', '1.5')).toBe('188.25');
    expect(multiply('0.1000', '0.1')).toBe('0.01');
  });

  it('starts every city hotel unchecked with editable default factors', () => {
    const rows = blankRows([
      {
        id: 'hotel-1',
        name: 'هتل یک',
        englishName: 'Hotel One',
        version: 7,
        starRating: 5,
      },
    ]);
    expect(rows).toEqual([
      expect.objectContaining({
        hotelId: 'hotel-1',
        hotelVersion: 7,
        hotelName: 'Hotel One',
        included: false,
        baseAmount: null,
        factors: expect.objectContaining({ double: '1', single: '1.5' }),
      }),
    ]);
  });
});
