import { expect, it } from 'vitest';
import {
  emptySalesForm,
  salesPayload,
  salesPassengerFlightDirections,
  salesFlightSeats,
} from './sales-form';
const passengers = ['both', 'return', 'hotel'].map((customerId) => ({
  customerId,
  displayName: customerId,
  birthDate: '1990-01-01',
}));
const state = {
  ...emptySalesForm,
  serviceKinds: ['FLIGHT', 'HOTEL'] as typeof emptySalesForm.serviceKinds,
  tripType: 'ROUND_TRIP' as const,
  departureDate: '2026-10-19',
  passengers,
  passengerComposition: { adults: 3, children: 0, infants: 0 },
  passengerFlightDirections: {
    both: ['OUTBOUND', 'RETURN'] as ('OUTBOUND' | 'RETURN')[],
    return: ['RETURN'] as ('OUTBOUND' | 'RETURN')[],
    hotel: [],
  },
  hotel: {
    ...emptySalesForm.hotel,
    hotelId: 'hotel',
    checkIn: '2026-10-19',
    checkOut: '2026-10-22',
    roomCount: 1,
    occupancy: 3,
    guestCustomerIds: ['both', 'return', 'hotel'],
  },
};
it('defaults both directions, then counts only assigned non-infants for each leg', () => {
  expect(
    salesPassengerFlightDirections(
      { ...state, passengerFlightDirections: undefined } as never,
      'hotel',
    ),
  ).toEqual(['OUTBOUND', 'RETURN']);
  expect(salesFlightSeats(state, 'OUTBOUND')).toBe(1);
  expect(salesFlightSeats(state, 'RETURN')).toBe(2);
});
it('sends direction assignments and excludes hotel-only people from flight prices', () => {
  const payload = salesPayload({
    ...state,
    passengerFlightPrices: {
      both: [{ currencyCode: 'IRR', amount: '100' }],
      return: [{ currencyCode: 'IRR', amount: '50' }],
      hotel: [{ currencyCode: 'IRR', amount: '999' }],
    },
    priceComponents: [
      { type: 'BASE', title: 'Test', amount: '150', currencyCode: 'IRR' },
    ],
  });
  expect(payload.passengers.map((p) => p.serviceClientKeys)).toEqual([
    ['flight-outbound', 'flight-return', 'hotel'],
    ['flight-return', 'hotel'],
    ['hotel'],
  ]);
  const prices = JSON.parse(
    String(payload.services[0]?.metadata?.passengerFlightPricesV1),
  );
  expect(Object.keys(prices)).toEqual(['both', 'return']);
});

it('sums manual hotel prices per guest once and drops old room agreements', () => {
  const payload = salesPayload({
    ...state,
    priceEntryMode: 'CONTRACT_TOTAL',
    automaticComponentPricing: true,
    passengerFlightPrices: {
      both: [{ currencyCode: 'IRR', amount: '100' }],
      return: [{ currencyCode: 'IRR', amount: '50' }],
    },
    passengerHotelPrices: {
      both: [{ currencyCode: 'USD', amount: '20' }],
      return: [{ currencyCode: 'USD', amount: '30' }],
      hotel: [{ currencyCode: 'USD', amount: '40' }],
    },
    hotel: {
      ...state.hotel,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: '00000000-0000-4000-8000-000000000001',
          roomTypeNameSnapshot: 'Standard',
          adults: 3,
          childAges: [],
          agreedPrice: { currencyCode: 'USD', amount: '999' },
        },
      ],
    },
  });
  expect(
    payload.priceComponents.map((p) => [p.currencyCode, p.amount]),
  ).toEqual([
    ['IRR', '150'],
    ['USD', '90'],
  ]);
  expect(payload.hotelSelection?.rooms?.[0]).not.toHaveProperty('agreedPrice');
  expect(
    payload.services.find((s) => s.kind === 'HOTEL')?.metadata
      ?.passengerHotelPricesV1,
  ).toBeDefined();
});
