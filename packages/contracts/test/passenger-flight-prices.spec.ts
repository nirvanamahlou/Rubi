import { expect, it } from 'vitest';
import {
  PASSENGER_FLIGHT_PRICES,
  flightRoomTotals,
  roomPriceShares,
  readPassengerFlightPrices,
  validatePassengerFlightPrices,
} from '../src';
const services = (prices: unknown) => [
  {
    clientKey: 'flight',
    kind: 'FLIGHT' as const,
    titleSnapshot: 'Flight',
    metadata: { [PASSENGER_FLIGHT_PRICES]: JSON.stringify(prices) },
  },
];
const passengers = [{ customerId: 'p', serviceClientKeys: ['flight'] }];
const components = [
  {
    type: 'BASE' as const,
    title: 'Contract',
    amount: '100',
    currencyCode: 'IRR',
  },
];
it('keeps legacy contracts compatible and separates combined flight breakdown from the contract total', () => {
  expect(readPassengerFlightPrices([])).toBeUndefined();
  expect(() =>
    validatePassengerFlightPrices([], passengers, components),
  ).not.toThrow();
  const s = services({ p: [{ amount: '40', currencyCode: 'IRR' }] });
  expect(() =>
    validatePassengerFlightPrices(s, passengers, components),
  ).not.toThrow();
  expect(components[0]!.amount).toBe('100');
  expect(readPassengerFlightPrices(s)?.p?.[0]?.amount).toBe('40');
});
it('rejects missing/foreign passengers, duplicates, invalid currencies/amounts and over-total breakdowns', () => {
  for (const p of [
    {},
    { q: [{ amount: '1', currencyCode: 'IRR' }] },
    { p: [] },
    { p: [{ amount: '101', currencyCode: 'IRR' }] },
    { p: [{ amount: '1', currencyCode: 'USD' }] },
    { p: [{ amount: '-1', currencyCode: 'IRR' }] },
    { p: [{ amount: '1.00001', currencyCode: 'IRR' }] },
    {
      p: [
        { amount: '1', currencyCode: 'IRR' },
        { amount: '1', currencyCode: 'IRR' },
      ],
    },
  ])
    expect(() =>
      validatePassengerFlightPrices(services(p), passengers, components),
    ).toThrow();
});
it('supports independent optional foreign amount and applies discounts to the upper bound', () => {
  const s = services({
    p: [
      { amount: '40', currencyCode: 'IRR' },
      { amount: '2.50', currencyCode: 'USD' },
    ],
  });
  expect(() =>
    validatePassengerFlightPrices(s, passengers, [
      ...components,
      { type: 'BASE', title: 'Foreign', amount: '3', currencyCode: 'USD' },
    ]),
  ).not.toThrow();
  expect(() =>
    validatePassengerFlightPrices(s, passengers, [
      ...components,
      {
        type: 'DISCOUNT',
        title: 'Discount',
        amount: '70',
        currencyCode: 'IRR',
      },
    ]),
  ).toThrow();
});

it('calculates contract totals by currency and splits rooms across adults without rounding loss', () => {
  const rooms = [
    { adults: 2, agreedPrice: { amount: '100.0001', currencyCode: 'USD' } },
  ];
  expect(
    flightRoomTotals(
      {
        a: [{ amount: '10', currencyCode: 'IRR' }],
        b: [{ amount: '20', currencyCode: 'IRR' }],
      },
      rooms,
    ),
  ).toEqual([
    { amount: '30', currencyCode: 'IRR' },
    { amount: '100.0001', currencyCode: 'USD' },
  ]);
  expect(roomPriceShares(rooms, ['a', 'b'])).toEqual({
    a: [{ amount: '50.0001', currencyCode: 'USD' }],
    b: [{ amount: '50', currencyCode: 'USD' }],
  });
  expect(() => roomPriceShares(rooms, ['a'])).toThrow();
});
