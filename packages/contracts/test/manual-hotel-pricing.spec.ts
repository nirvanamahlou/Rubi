import { describe, expect, it } from 'vitest';
import {
  calculateManualHotelPrices,
  quoteHotelOccupancy,
} from '../src/package-pricing';
describe('manual hotel purchase and sale prices', () => {
  it.each([
    [{ kind: 'AMOUNT' as const, value: '0' }, '200.00'],
    [{ kind: 'PERCENT' as const, value: '10' }, '220.00'],
    [{ kind: 'PERCENT' as const, value: '-10' }, '180.00'],
    [{ kind: 'AMOUNT' as const, value: '15.25' }, '215.25'],
    [{ kind: 'AMOUNT' as const, value: '-15.25' }, '184.75'],
    [{ kind: 'SET' as const, value: '199.99' }, '199.99'],
  ])('never alters purchase when changing sale %j', (adjustment, sale) => {
    expect(calculateManualHotelPrices('100', '2', 'EUR', adjustment)).toEqual({
      purchase: '200.00',
      sale,
    });
  });
  it('rounds currency exactly and rejects negative prices and overflow', () => {
    expect(calculateManualHotelPrices('0.05', '1.5', 'EUR')?.purchase).toBe(
      '0.08',
    );
    expect(calculateManualHotelPrices('101', '1.5', 'IRR')?.purchase).toBe(
      '152',
    );
    expect(
      calculateManualHotelPrices('100', '2', 'EUR', {
        kind: 'PERCENT',
        value: '-101',
      }),
    ).toBeNull();
    expect(
      calculateManualHotelPrices('100', '2', 'EUR', {
        kind: 'AMOUNT',
        value: '-201',
      }),
    ).toBeNull();
    expect(calculateManualHotelPrices('1.5', '2', 'IRR')).toBeNull();
    expect(calculateManualHotelPrices('999999999999', '999', 'EUR')).toBeNull();
    expect(calculateManualHotelPrices('1', '0', 'EUR')).toBeNull();
  });
  it('keeps default purchase quoting and opts Sales into sale quoting', () => {
    const rates = [
      {
        adults: 2,
        childAges: [],
        startsOn: '2026-10-01',
        endsOnExclusive: '2026-11-01',
        currencyCode: 'EUR',
        board: '',
        composition: 'DBL',
        amount: '200',
        saleAmount: '220',
      },
    ];
    const input = {
      adults: 2,
      childAges: [],
      rooms: 1,
      checkIn: '2026-10-05',
      checkOut: '2026-10-07',
    };
    expect(quoteHotelOccupancy(rates, input)?.amount).toBe('400');
    expect(
      quoteHotelOccupancy(rates, { ...input, priceBasis: 'SALE' })?.amount,
    ).toBe('440');
    expect(
      quoteHotelOccupancy(
        rates.map((r) => ({
          adults: r.adults,
          childAges: r.childAges,
          startsOn: r.startsOn,
          endsOnExclusive: r.endsOnExclusive,
          currencyCode: r.currencyCode,
          board: r.board,
          composition: r.composition,
          amount: r.amount,
        })),
        { ...input, priceBasis: 'SALE' },
      )?.amount,
    ).toBe('400');
  });
});
