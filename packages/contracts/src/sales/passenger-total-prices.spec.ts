import { describe, expect, it } from 'vitest';
import {
  PASSENGER_TOTAL_PRICES,
  readPassengerTotalPrices,
  validatePassengerTotalPricing,
} from './passenger-total-prices';
const id = 'person';
const gross = {
  [id]: [
    { amount: '100', currencyCode: 'IRR' },
    { amount: '20', currencyCode: 'USD' },
  ],
};
const source = () => [
  {
    metadata: {
      passengerPackagePricingVersion: 1,
      [PASSENGER_TOTAL_PRICES]: JSON.stringify(gross),
      passengerDeductionsV1: JSON.stringify({
        [id]: { discount: { amount: '10', currencyCode: 'IRR' } },
      }),
    },
  },
];
describe('total per-passenger IRR and foreign prices', () => {
  it('keeps legacy absence and validates the gross/net amounts without service allocation', () => {
    expect(readPassengerTotalPrices([], [{ customerId: id }])).toBeNull();
    expect(readPassengerTotalPrices(source(), [{ customerId: id }])).toEqual(
      gross,
    );
    expect(() =>
      validatePassengerTotalPricing(source(), [
        {
          customerId: id,
          agreedPrices: [
            { amount: '90', currencyCode: 'IRR' },
            { amount: '20', currencyCode: 'USD' },
          ],
        },
      ]),
    ).not.toThrow();
    expect(() =>
      validatePassengerTotalPricing(source(), [
        {
          customerId: id,
          agreedPrices: [
            { amount: '100', currencyCode: 'IRR' },
            { amount: '20', currencyCode: 'USD' },
          ],
        },
      ]),
    ).toThrow('مبلغ نهایی هر مسافر');
  });
  it('rejects unknown passengers, duplicate currencies and two foreign currencies', () => {
    for (const value of [
      { other: gross[id] },
      { [id]: [gross[id][0], gross[id][0]] },
      { [id]: [gross[id][1], { amount: '1', currencyCode: 'EUR' }] },
      { [id]: [{ amount: '-1', currencyCode: 'USD' }] },
    ]) {
      expect(() =>
        readPassengerTotalPrices(
          [
            {
              metadata: {
                passengerPackagePricingVersion: 1,
                [PASSENGER_TOTAL_PRICES]: JSON.stringify(value),
              },
            },
          ],
          [{ customerId: id }],
        ),
      ).toThrow();
    }
  });
  it('rejects a discount above the same-person currency amount', () => {
    const services = source();
    services[0]!.metadata.passengerDeductionsV1 = JSON.stringify({
      [id]: { discount: { amount: '101', currencyCode: 'IRR' } },
    });
    expect(() =>
      validatePassengerTotalPricing(services, [
        { customerId: id, agreedPrices: [] },
      ]),
    ).toThrow('نباید از قیمت همان مسافر');
  });
});
