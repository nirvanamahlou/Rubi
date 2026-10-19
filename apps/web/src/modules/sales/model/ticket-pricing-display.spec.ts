import { expect, it } from 'vitest';
import {
  pricingCityCountries,
  pricingFlightDate,
  rialFirst,
} from './ticket-pricing-display';
const flight = {
  originId: 'tehran',
  destinationId: 'antalya',
  departureAt: '2026-10-18T21:30:00Z',
};
it('uses Gregorian dates for either foreign endpoint and keeps Tehran midnight', () => {
  expect(pricingFlightDate(flight, { tehran: 'IR', antalya: 'TR' })).toBe(
    '19 October 2026',
  );
  expect(
    pricingFlightDate(
      { ...flight, originId: 'antalya', destinationId: 'tehran' },
      { tehran: 'IR', antalya: 'TR' },
    ),
  ).toBe('19 October 2026');
  expect(
    pricingFlightDate(flight, { tehran: 'IR', antalya: 'IRN' }),
  ).not.toContain('2026');
  expect(pricingFlightDate(flight, {})).not.toContain('2026');
  expect(pricingFlightDate(flight, { antalya: 'TR' }, true)).toContain('01:00');
});
it('resolves city geography using country IDs and canonical ISO codes', () => {
  expect(
    pricingCityCountries(
      [
        { id: 'tehran', attributes: { countryId: 'one' } },
        { id: 'antalya', attributes: { countryId: 'two' } },
      ],
      [
        { id: 'one', code: 'IRAN', attributes: { iso2Code: 'IR' } },
        { id: 'two', code: 'TR', attributes: {} },
      ],
    ),
  ).toEqual({ tehran: 'IR', antalya: 'TR' });
});
it('puts IRR first without mutating other order or inventing currency', () => {
  const codes = ['AED', 'USD', 'IRR', 'EUR'];
  expect(rialFirst(codes, (x) => x)).toEqual(['IRR', 'AED', 'USD', 'EUR']);
  expect(codes).toEqual(['AED', 'USD', 'IRR', 'EUR']);
  expect(rialFirst(['USD'], (x) => x)).toEqual(['USD']);
});
