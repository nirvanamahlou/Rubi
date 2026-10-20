import { describe, expect, it } from 'vitest';
import {
  validatePassengerTotalPricing,
  validatePassengerPackagePrices,
  readPassengerTotalPrices,
} from '@nora/contracts';
import {
  emptySalesForm,
  salesPayload,
  type SalesFormState,
} from './sales-form';
import { passengerTotalEntry } from './passenger-total-entry';
const draft: SalesFormState = {
  ...emptySalesForm,
  passengerTotalPricing: true,
  priceEntryMode: 'CONTRACT_TOTAL',
  automaticComponentPricing: true,
  serviceKinds: ['FLIGHT', 'HOTEL'],
  departureDate: '2026-11-01',
  passengers: [
    {
      customerId: 'a',
      displayName: 'Synthetic Full Name',
      birthDate: '1990-01-01',
    },
  ],
  hotel: {
    ...emptySalesForm.hotel,
    guestCustomerIds: ['a'],
    checkIn: '2026-11-01',
    checkOut: '2026-11-08',
  },
  passengerPrices: {
    a: [
      { amount: '100', currencyCode: 'IRR' },
      { amount: '25', currencyCode: 'USD' },
    ],
  },
  passengerFlightPrices: { a: [{ amount: '9999', currencyCode: 'IRR' }] },
  passengerHotelPrices: { a: [{ amount: '9999', currencyCode: 'USD' }] },
  passengerDeductions: {
    a: {
      discount: { amount: '10', currencyCode: 'IRR' },
      commission: { amount: '5', currencyCode: 'USD' },
    },
  },
};
describe('total passenger pricing persistence', () => {
  it('counts total amounts once, sends net agreed prices, preserves gross and removes legacy service pricing', () => {
    const payload = salesPayload(draft);
    expect(payload.priceComponents).toEqual(
      expect.arrayContaining([
        {
          type: 'BASE',
          title: 'جمع قیمت کل مسافران',
          amount: '90',
          currencyCode: 'IRR',
        },
        {
          type: 'BASE',
          title: 'جمع قیمت کل مسافران',
          amount: '20',
          currencyCode: 'USD',
        },
      ]),
    );
    expect(payload.passengers[0]!.agreedPrices).toEqual([
      { amount: '90', currencyCode: 'IRR' },
      { amount: '20', currencyCode: 'USD' },
    ]);
    expect(
      readPassengerTotalPrices(payload.services, payload.passengers),
    ).toEqual(draft.passengerPrices);
    expect(
      payload.services.every(
        (s) =>
          s.pricing === undefined &&
          !s.metadata?.automaticFlightRoomTotalV1 &&
          !s.metadata?.passengerFlightPricesV1 &&
          !s.metadata?.passengerHotelPricesV1,
      ),
    ).toBe(true);
    expect(() =>
      validatePassengerTotalPricing(payload.services, payload.passengers),
    ).not.toThrow();
    expect(() =>
      validatePassengerPackagePrices(
        payload.passengers,
        payload.priceComponents,
        true,
      ),
    ).not.toThrow();
  });
  it('preserves legacy draft values by summing each currency without conversion', () => {
    expect(
      passengerTotalEntry({ ...draft, passengerPrices: undefined }, 'a'),
    ).toEqual([
      { currencyCode: 'IRR', amount: '9999' },
      { currencyCode: 'USD', amount: '9999' },
    ]);
  });
  it('rejects missing totals or deductions above the person total', () => {
    expect(() =>
      salesPayload({ ...draft, passengerPrices: { a: [] } }),
    ).toThrow();
    expect(() =>
      salesPayload({
        ...draft,
        passengerDeductions: {
          a: { discount: { amount: '101', currencyCode: 'IRR' } },
        },
      }),
    ).toThrow('نباید از قیمت همان مسافر');
  });
});
