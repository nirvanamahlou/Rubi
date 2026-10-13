import { expect, it } from 'vitest';
import {
  tourPriceFields,
  tourPriceFieldValues,
  validateTourPriceFields,
} from '../src/package-pricing/price-fields';
import { calculateTourRoom } from '../src/package-pricing/tour-calculation';

it('restores legacy values but keeps explicitly deleted default fields deleted', () => {
  expect(
    tourPriceFields({
      adultFlightSale: '25',
      adultFlightSaleCurrencyCode: 'USD',
    })[0],
  ).toMatchObject({ amount: '25', currencyCode: 'USD' });
  expect(tourPriceFields({ priceFields: [] })).toEqual([]);
  expect(tourPriceFieldValues([])).toMatchObject({
    adultFlightSale: '0',
    childFlightSale: '0',
    businessUplift: '0',
    commissionPercent: '0',
    commissionAmount: '0',
  });
});

it('validates typed rows and rejects duplicate roles/ids, invalid precision and percentages', () => {
  const fields = tourPriceFields();
  for (const invalid of [
    [...fields, fields[0]],
    [{ ...fields[0], amount: '0.5' }],
    [{ ...fields[0], title: ' ' }],
    [{ ...fields[0], currencyCode: 'US' }],
    [{ ...fields[3], amount: '100.01' }],
    [{ ...fields[0], id: 'second' }, fields[0]],
  ]) {
    expect(() => validateTourPriceFields(invalid)).toThrow();
  }
  expect(
    validateTourPriceFields([
      {
        id: 'new',
        title: '  Custom  ',
        kind: 'custom',
        amount: '20.50',
        currencyCode: 'GBP',
        mode: 'fixed',
      },
    ])[0]?.title,
  ).toBe('Custom');
});

it('adds custom package amounts once and keeps currencies and commission separate', () => {
  const result = calculateTourRoom({
    basePerNight: '100',
    factor: '1',
    nights: 1,
    hotelCurrency: 'EUR',
    adjustment: { direction: 'increase', mode: 'fixed', value: '0' },
    adults: 2,
    children: 1,
    adultFlight: { amount: '0', currencyCode: 'IRR' },
    childFlight: { amount: '0', currencyCode: 'IRR' },
    businessUplift: { amount: '0', currencyCode: 'IRR' },
    businessCabin: false,
    commissionPercent: '0',
    commissionMode: 'fixed',
    commissionAmount: { amount: '2', currencyCode: 'GBP' },
    extraSaleFields: [
      { amount: '20.50', currencyCode: 'GBP' },
      { amount: '1.25', currencyCode: 'GBP' },
    ],
    flightCosts: [],
  });
  expect(result.currencyAmounts).toEqual([
    {
      currencyCode: 'EUR',
      sale: '100.00',
      purchase: '100.00',
      commission: '0.00',
      profit: '0.00',
    },
    {
      currencyCode: 'GBP',
      sale: '21.75',
      purchase: '0.00',
      commission: '2.00',
      profit: '19.75',
    },
  ]);
});
