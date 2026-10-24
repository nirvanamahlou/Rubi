import { expect, it } from 'vitest';
import {
  PASSENGER_TOTAL_PRICES,
  PASSENGER_DEDUCTIONS,
  validatePassengerTotalPricing,
  type SalesContractAmendmentV1,
} from '@nora/contracts';
import {
  amendmentPassengerGross,
  applyAmendmentPassengerPrices,
} from './amendment-passenger-prices';
const gross = {
  a: [
    { amount: '100', currencyCode: 'USD' },
    { amount: '1000', currencyCode: 'IRR' },
  ],
  b: [{ amount: '50', currencyCode: 'USD' }],
};
const draft = {
  services: [
    {
      clientKey: 'hotel',
      kind: 'HOTEL',
      metadata: {
        passengerPackagePricingVersion: 1,
        [PASSENGER_TOTAL_PRICES]: JSON.stringify(gross),
      },
    },
  ],
  passengers: [
    { customerId: 'a', agreedPrices: gross.a },
    { customerId: 'b', agreedPrices: gross.b },
  ],
  priceComponents: [],
  hotelSelection: {
    rooms: [{ agreedPrice: { amount: '9999', currencyCode: 'USD' } }],
  },
} as unknown as SalesContractAmendmentV1;
it('edits each passenger gross and deductions once, without adding old room prices', () => {
  const next = applyAmendmentPassengerPrices(draft, gross, {
    a: {
      discount: { amount: '10', currencyCode: 'USD' },
      commission: { amount: '5', currencyCode: 'USD' },
    },
  });
  expect(next.passengers[0]!.agreedPrices).toEqual([
    { currencyCode: 'USD', amount: '85' },
    { currencyCode: 'IRR', amount: '1000' },
  ]);
  expect(next.priceComponents.map((p) => [p.currencyCode, p.amount])).toEqual([
    ['USD', '135'],
    ['IRR', '1000'],
  ]);
  expect(() =>
    validatePassengerTotalPricing(next.services, next.passengers),
  ).not.toThrow();
  const changed = applyAmendmentPassengerPrices(
    next,
    { ...gross, a: [{ amount: '120', currencyCode: 'USD' }, gross.a[1]!] },
    { a: { commission: { amount: '2', currencyCode: 'USD' } } },
  );
  expect(changed.passengers[0]!.agreedPrices?.[0]?.amount).toBe('118');
  expect(
    JSON.parse(String(changed.services[0]!.metadata![PASSENGER_DEDUCTIONS])).a
      .discount,
  ).toBeUndefined();
});
it('recovers legacy gross from net plus deductions and preserves zero-fare passengers', () => {
  const legacy = {
    ...draft,
    services: [
      {
        ...draft.services[0]!,
        metadata: {
          passengerPackagePricingVersion: 1,
          [PASSENGER_DEDUCTIONS]: JSON.stringify({
            a: { discount: { amount: '10', currencyCode: 'USD' } },
          }),
        },
      },
    ],
    passengers: [
      {
        ...draft.passengers[0]!,
        agreedPrices: [{ amount: '90', currencyCode: 'USD' }],
      },
      {
        ...draft.passengers[1]!,
        agreedPrices: [{ amount: '0', currencyCode: 'USD' }],
      },
    ],
  };
  const prices = amendmentPassengerGross(legacy);
  expect(prices.a).toEqual([{ currencyCode: 'USD', amount: '100' }]);
  expect(() =>
    validatePassengerTotalPricing(
      applyAmendmentPassengerPrices(legacy, prices, {}).services,
      applyAmendmentPassengerPrices(legacy, prices, {}).passengers,
    ),
  ).not.toThrow();
});
it('rejects excessive or cross-currency deductions and incomplete passengers', () => {
  expect(() =>
    applyAmendmentPassengerPrices(draft, gross, {
      a: { commission: { amount: '101', currencyCode: 'USD' } },
    }),
  ).toThrow('همان مسافر');
  expect(() =>
    applyAmendmentPassengerPrices(draft, gross, {
      a: { discount: { amount: '1', currencyCode: 'EUR' } },
    }),
  ).toThrow('همان ارز');
  expect(() =>
    applyAmendmentPassengerPrices(draft, { ...gross, b: [] }, {}),
  ).toThrow('هر مسافر');
});
