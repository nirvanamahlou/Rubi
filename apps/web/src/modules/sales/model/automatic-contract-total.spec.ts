import {
  readPassengerFlightPrices,
  validatePassengerFlightPrices,
} from '@nora/contracts';
import { expect, it } from 'vitest';
import {
  contractSaleComponents,
  emptySalesForm,
  salesPayload,
} from './sales-form';
it('counts room foreign currency once and excludes stale foreign flight inputs', () => {
  const result = contractSaleComponents({
    ...emptySalesForm,
    automaticComponentPricing: true,
    serviceKinds: ['FLIGHT', 'HOTEL'],
    passengers: [
      { customerId: 'p', displayName: 'TEST', birthDate: '1990-01-01' },
    ],
    passengerFlightPrices: {
      p: [
        { amount: '100', currencyCode: 'IRR' },
        { amount: '5', currencyCode: 'USD' },
      ],
    },
    contractPrices: [{ amount: '99999', currencyCode: 'IRR' }],
    hotel: {
      ...emptySalesForm.hotel,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'double',
          roomTypeNameSnapshot: 'DOUBLE',
          adults: 2,
          childAges: [],
          agreedPrice: { amount: '100', currencyCode: 'USD' },
        },
      ],
    },
  });
  expect(result.map((p) => [p.currencyCode, p.amount])).toEqual([
    ['IRR', '100'],
    ['USD', '100'],
  ]);
});

it('keeps standalone foreign flight pricing independent when no hotel is selected', () => {
  const result = contractSaleComponents({
    ...emptySalesForm,
    automaticComponentPricing: true,
    serviceKinds: ['FLIGHT'],
    passengers: [
      { customerId: 'p', displayName: 'Test', birthDate: '1990-01-01' },
    ],
    passengerFlightPrices: { p: [{ currencyCode: 'USD', amount: '15' }] },
  });
  expect(result.map((p) => [p.currencyCode, p.amount])).toEqual([
    ['USD', '15'],
  ]);
});

it('submits the room foreign amount once and never persists it as a passenger flight price', () => {
  const passengers = ['a', 'b'].map((customerId) => ({
    customerId,
    displayName: customerId,
    birthDate: '1990-01-01',
  }));
  const payload = salesPayload({
    ...emptySalesForm,
    priceEntryMode: 'CONTRACT_TOTAL',
    automaticComponentPricing: true,
    departureDate: '2026-11-23',
    serviceKinds: ['FLIGHT', 'HOTEL'],
    passengers,
    passengerComposition: { adults: 2, children: 0, infants: 0 },
    passengerFlightPrices: Object.fromEntries(
      passengers.map((p) => [
        p.customerId,
        [
          { currencyCode: 'IRR', amount: '100' },
          { currencyCode: 'USD', amount: '12500' },
        ],
      ]),
    ),
    hotel: {
      ...emptySalesForm.hotel,
      hotelId: 'hotel',
      checkIn: '2026-11-23',
      checkOut: '2026-11-25',
      guestCustomerIds: ['a', 'b'],
      rooms: [
        {
          ordinal: 1,
          roomTypeId: '10000000-0000-4000-8000-000000000001',
          roomTypeNameSnapshot: 'Standard',
          adults: 2,
          childAges: [],
          agreedPrice: { currencyCode: 'USD', amount: '25000' },
        },
      ],
    },
  });
  expect(
    payload.priceComponents.map((p) => [p.currencyCode, p.amount]),
  ).toEqual([
    ['IRR', '200'],
    ['USD', '25000'],
  ]);
  expect(readPassengerFlightPrices(payload.services)).toEqual({
    a: [{ currencyCode: 'IRR', amount: '100' }],
    b: [{ currencyCode: 'IRR', amount: '100' }],
  });
  expect(() =>
    validatePassengerFlightPrices(
      payload.services,
      payload.passengers,
      payload.priceComponents,
    ),
  ).not.toThrow();
});
