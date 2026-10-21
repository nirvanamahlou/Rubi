import { describe, expect, it } from 'vitest';
import {
  emptySalesForm,
  salesPayload,
  type SalesFormState,
} from './sales-form';
import { passengerSlotKeys } from './sales-people-sheet';
import { withRoomDrivenGuests } from './contract-guest-stays';
import {
  readPassengerHotelStays,
  validatePassengerHotelStays,
} from '@nora/contracts';
import { salesRoomPartyError } from './sales-room-prices';
const state = withRoomDrivenGuests({
  ...emptySalesForm,
  roomDrivenGuests: true,
  serviceKinds: ['FLIGHT', 'HOTEL'],
  departureDate: '2099-10-01',
  passengerHotelPrices: {
    a: [{ amount: '100', currencyCode: 'USD' }],
    b: [{ amount: '200', currencyCode: 'IRR' }],
  },
  passengerHotelStays: {
    a: { different: true, checkIn: '2099-10-02', checkOut: '2099-10-05' },
  },
  hotel: {
    ...emptySalesForm.hotel,
    checkIn: '2099-10-01',
    checkOut: '2099-10-07',
    hotelId: 'hotel',
    name: 'Sample',
    guestCustomerIds: ['a', 'b'],
    rooms: [
      {
        ordinal: 1,
        roomTypeId: '11111111-1111-4111-8111-111111111111',
        roomTypeNameSnapshot: 'Double',
        adults: 2,
        childAges: [],
      },
    ],
  },
  flightOnlyPassengers: [{ key: 'flight-only-0', age: 18 }],
  passengers: [
    { customerId: 'a', displayName: 'Sample A', birthDate: '1990-01-01' },
    { customerId: 'b', displayName: 'Sample B', birthDate: '1990-01-01' },
    {
      customerId: 'flight',
      displayName: 'Flight Only',
      birthDate: '1990-01-01',
    },
  ],
});
describe('combined contract guest memberships and dates', () => {
  it('derives three people from two hotel guests and one flight-only row with stable keys', () => {
    expect(state.passengerComposition).toEqual({
      adults: 3,
      children: 0,
      infants: 0,
    });
    expect(passengerSlotKeys(state)).toEqual(['p0', 'p1', 'flight-only-0']);
    expect(salesRoomPartyError(state)).toBeNull();
  });
  it('snapshots default and different dates only for hotel service members', () => {
    const payload = salesPayload(state),
      stays = readPassengerHotelStays(payload.services)!;
    expect(stays.a).toEqual({
      different: true,
      checkInDate: '2099-10-02',
      checkOutDate: '2099-10-05',
    });
    expect(stays.b).toEqual({
      different: false,
      checkInDate: '2099-10-01',
      checkOutDate: '2099-10-07',
    });
    expect(stays.flight).toBeUndefined();
    expect(() => validatePassengerHotelStays(payload)).not.toThrow();
  });
  it('rejects forged stay membership and reversed dates before persistence', () => {
    const payload = salesPayload(state);
    const forge = (entries: unknown) => ({
      ...payload,
      services: payload.services.map((s) =>
        s.kind === 'HOTEL'
          ? {
              ...s,
              metadata: {
                ...s.metadata,
                passengerHotelStaysV1: JSON.stringify(entries),
              },
            }
          : s,
      ),
    });
    expect(() =>
      validatePassengerHotelStays(
        forge({
          flight: {
            different: true,
            checkInDate: '2099-10-02',
            checkOutDate: '2099-10-05',
          },
        }),
      ),
    ).toThrow();
    expect(() =>
      validatePassengerHotelStays(
        forge({
          a: {
            different: true,
            checkInDate: '2099-10-06',
            checkOutDate: '2099-10-05',
          },
        }),
      ),
    ).toThrow();
  });
  it('accepts a different stay using passenger service totals without obsolete hotel prices', () => {
    const input: SalesFormState = {
      ...state,
      passengerTotalPricing: true,
      passengerPrices: Object.fromEntries(
        state.passengers.map((p) => [
          p.customerId,
          [{ amount: '100', currencyCode: 'USD' }],
        ]),
      ),
    };
    delete input.passengerHotelPrices;
    const payload = salesPayload(input);
    expect(() => validatePassengerHotelStays(payload)).not.toThrow();
    expect(
      payload.services.find((s) => s.kind === 'HOTEL')?.metadata
        ?.passengerHotelPricesV1,
    ).toBeUndefined();
    expect(readPassengerHotelStays(payload.services)?.a?.different).toBe(true);
  });
});

it('counts the individually entered stay price once in the contract total', () => {
  const input = {
    ...state,
    automaticComponentPricing: true,
    priceEntryMode: 'CONTRACT_TOTAL' as const,
    passengerFlightPrices: Object.fromEntries(
      state.passengers.map((p) => [
        p.customerId,
        [{ amount: '10', currencyCode: 'IRR' }],
      ]),
    ),
  };
  const payload = salesPayload(input);
  expect(
    payload.priceComponents
      .filter((p) => p.currencyCode === 'USD')
      .map((p) => p.amount),
  ).toEqual(['100']);
  expect(
    payload.priceComponents
      .filter((p) => p.currencyCode === 'IRR')
      .map((p) => p.amount),
  ).toEqual(['230']);
});

it('keeps default stays following later shared-date edits without changing explicit overrides', () => {
  const payload = salesPayload(state);
  const stays = readPassengerHotelStays(payload.services, {
    checkInDate: '2099-10-03',
    checkOutDate: '2099-10-08',
  })!;
  expect(stays.a?.checkInDate).toBe('2099-10-02');
  expect(stays.b?.checkInDate).toBe('2099-10-03');
});
