import { describe, expect, it } from 'vitest';
import {
  validatePassengerPackagePrices,
  validateInsuranceExtras,
  servicePriceComponents,
} from '@nora/contracts';
import { salesPayload, emptySalesForm } from './sales-form';
import { passengerSaleTotals } from './passenger-sale-totals';
const people = [
  { customerId: 'one', displayName: 'One', birthDate: '1990-01-01' },
  { customerId: 'two', displayName: 'Two', birthDate: '2000-01-01' },
];
describe('passenger package as sales source', () => {
  it('derives exact independent currency totals, ignoring removed people and old service pricing', () => {
    const payload = salesPayload({
      ...emptySalesForm,
      priceEntryMode: 'PASSENGER_TOTAL',
      serviceKinds: ['OTHER'],
      servicePricing: {
        other: [
          {
            version: 1,
            currencyCode: 'IRR',
            daySale: { basis: 'TOTAL', amount: '999' },
            agreed: { basis: 'TOTAL', amount: '999' },
          },
        ],
      },
      passengers: people,
      passengerPrices: {
        one: [
          { currencyCode: 'IRR', amount: '9007199254740993.1234' },
          { currencyCode: 'EUR', amount: '15.005' },
        ],
        two: [
          { currencyCode: 'IRR', amount: '0.0006' },
          { currencyCode: 'USD', amount: '10' },
        ],
        removed: [{ currencyCode: 'IRR', amount: '999' }],
      },
    });
    expect(
      payload.priceComponents.map((p) => [p.currencyCode, p.amount]),
    ).toEqual([
      ['IRR', '9007199254740993.124'],
      ['EUR', '15.005'],
      ['USD', '10'],
    ]);
    expect(payload.services[0]?.pricing).toBeUndefined();
    expect(servicePriceComponents(payload.services)).toBeNull();
    expect(() =>
      validatePassengerPackagePrices(
        payload.passengers,
        payload.priceComponents,
        true,
      ),
    ).not.toThrow();
  });
  it('requires an explicit price for each person and rejects duplicate currencies or invalid decimals', () => {
    expect(() =>
      passengerSaleTotals(people, {
        one: [{ currencyCode: 'IRR', amount: '1' }],
      }),
    ).toThrow();
    for (const values of [
      [{ currencyCode: 'IRR', amount: '-1' }],
      [{ currencyCode: 'IRR', amount: '' }],
      [
        { currencyCode: 'USD', amount: '1' },
        { currencyCode: 'USD', amount: '2' },
      ],
    ])
      expect(() =>
        passengerSaleTotals([people[0]!], { one: values }),
      ).toThrow();
  });
  it('keeps a free passenger without creating a zero-valued contract component', () => {
    const value = passengerSaleTotals(people, {
      one: [{ currencyCode: 'IRR', amount: '100' }],
      two: [{ currencyCode: 'USD', amount: '0' }],
    });
    expect(value.components).toHaveLength(1);
    expect(value.prices.two).toEqual([{ currencyCode: 'IRR', amount: '0' }]);
  });
});

it('adds an existing age insurance surcharge once while package services have no separate sale price', () => {
  const state = {
    ...emptySalesForm,
    priceEntryMode: 'PASSENGER_TOTAL' as const,
    serviceKinds: ['INSURANCE' as const],
    departureDate: '2026-10-10',
    passengers: [
      { customerId: 'one', displayName: 'Senior', birthDate: '1950-01-01' },
    ],
    passengerPrices: { one: [{ currencyCode: 'IRR', amount: '1000' }] },
    insuranceExtraToman: { one: '10' },
    insurancePlan: {
      id: 'plan',
      name: 'Policy',
      code: 'P',
      recordVersion: 1,
      insurerId: 'insurer',
      insurerName: 'Insurer',
    },
  };
  const payload = salesPayload(state);
  expect(payload.priceComponents).toEqual([
    {
      type: 'BASE',
      title: 'جمع قیمت کل مسافران',
      currencyCode: 'IRR',
      amount: '1100',
    },
  ]);
  expect(() => validateInsuranceExtras(payload)).not.toThrow();
  expect(payload.passengers[0]?.agreedPrices).toEqual([
    { currencyCode: 'IRR', amount: '1100' },
  ]);
  expect(servicePriceComponents(payload.services)).toBeNull();
  expect(() =>
    validatePassengerPackagePrices(
      payload.passengers,
      payload.priceComponents,
      true,
    ),
  ).not.toThrow();
});
