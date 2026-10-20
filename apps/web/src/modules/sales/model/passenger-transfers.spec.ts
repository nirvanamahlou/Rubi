import { describe, expect, it } from 'vitest';
import {
  emptySalesForm,
  salesPayload,
  salesPassengerTransferDirections,
  salesTransferCount,
  type SalesFormState,
} from './sales-form';

const state: SalesFormState = {
  ...emptySalesForm,
  departureDate: '2026-11-01',
  tripType: 'ROUND_TRIP',
  serviceKinds: ['FLIGHT', 'TRANSFER', 'OTHER'],
  passengers: ['a', 'b', 'c'].map((customerId) => ({
    customerId,
    displayName: customerId,
    birthDate: '1990-01-01',
  })),
};

describe('per-person transfer assignments', () => {
  it('defaults every person to both enabled transfer legs independently of flights', () => {
    const input = {
      ...state,
      passengerFlightDirections: { a: [], b: ['RETURN'] as ['RETURN'] },
    };
    for (const id of ['a', 'b', 'c'])
      expect(salesPassengerTransferDirections(input, id)).toEqual([
        'OUTBOUND',
        'RETURN',
      ]);
    expect(salesPayload(input).passengers[0]!.serviceClientKeys).toEqual([
      'transfer-outbound',
      'transfer-return',
      'other',
    ]);
    expect(salesTransferCount({ ...input, serviceKinds: ['OTHER'] })).toBe(0);
  });
  it('persists different leg memberships and derives each leg quantity without changing prices', () => {
    const input: SalesFormState = {
      ...state,
      passengerTransferDirections: { a: ['OUTBOUND'], b: ['RETURN'], c: [] },
      passengerFlightDirections: { a: ['RETURN'], b: ['OUTBOUND'], c: [] },
      priceComponents: [
        { type: 'BASE', title: 'Test', amount: '100.25', currencyCode: 'USD' },
      ],
    };
    const payload = salesPayload(input);
    expect(payload.passengers.map((p) => p.serviceClientKeys)).toEqual([
      ['flight-return', 'transfer-outbound', 'other'],
      ['flight-outbound', 'transfer-return', 'other'],
      ['other'],
    ]);
    expect(
      payload.services
        .filter((s) => s.kind === 'TRANSFER')
        .map((s) => s.metadata?.passengerCount),
    ).toEqual([1, 1]);
    expect(payload.priceComponents).toEqual(input.priceComponents);
    expect(input.passengerTransferDirections).toEqual({
      a: ['OUTBOUND'],
      b: ['RETURN'],
      c: [],
    });
  });
  it('omits a leg when everyone is excluded and restores default membership for a new person', () => {
    const input: SalesFormState = {
      ...state,
      passengerTransferDirections: { a: ['OUTBOUND'], b: [], c: [] },
    };
    expect(
      salesPayload(input)
        .services.filter((s) => s.kind === 'TRANSFER')
        .map((s) => s.clientKey),
    ).toEqual(['transfer-outbound']);
    expect(salesPassengerTransferDirections(input, 'new')).toEqual([
      'OUTBOUND',
      'RETURN',
    ]);
    expect(
      salesPassengerTransferDirections(
        { ...input, serviceDirections: { TRANSFER: ['OUTBOUND'] } },
        'new',
      ),
    ).toEqual(['OUTBOUND']);
  });
});

it('sends selected city tour and guide as actual services alongside the existing visa assignments', () => {
  const input: SalesFormState = {
    ...state,
    serviceKinds: ['VISA'],
    additionalServices: ['CITY_TOUR', 'TOUR_GUIDE'],
  };
  const payload = salesPayload(input);
  expect(
    payload.services.map((s) => [s.clientKey, s.kind, s.titleSnapshot]),
  ).toEqual([
    ['visa', 'VISA', 'خدمات ویزا'],
    ['city-tour', 'OTHER', 'گشت شهری'],
    ['tour-guide', 'OTHER', 'راهنما'],
  ]);
  for (const person of payload.passengers)
    expect(person.serviceClientKeys).toEqual([
      'visa',
      'city-tour',
      'tour-guide',
    ]);
  expect(
    salesPayload({ ...input, additionalServices: [] }).services.map(
      (s) => s.clientKey,
    ),
  ).toEqual(['visa']);
});
