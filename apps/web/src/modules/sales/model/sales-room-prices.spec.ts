import type * as Contracts from '@nora/contracts';
import { describe, it, expect, vi } from 'vitest';
import { emptySalesForm, type SalesFormState } from './sales-form';
import {
  salesRoomPartyError,
  roomAgreedTotals,
  withRoomPriceTotals,
} from './sales-room-prices';
const rooms = [
  {
    ordinal: 1,
    roomTypeId: 'double',
    roomTypeNameSnapshot: 'Double',
    adults: 4,
    childAges: [5],
    agreedPrice: { amount: '60.25', currencyCode: 'USD' },
  },
  {
    ordinal: 2,
    roomTypeId: 'single',
    roomTypeNameSnapshot: 'Single',
    adults: 2,
    childAges: [7],
    agreedPrice: { amount: '40.10', currencyCode: 'USD' },
  },
];
const state: SalesFormState = {
  ...emptySalesForm,
  serviceKinds: ['FLIGHT', 'HOTEL'],
  passengerComposition: { adults: 6, children: 2, infants: 0 },
  hotel: { ...emptySalesForm.hotel, rooms },
  contractPrices: [
    { currencyCode: 'IRR', amount: '50000000' },
    { currencyCode: 'USD', amount: '120.35' },
  ],
};
describe('room party and agreed sale allocation', () => {
  it('limits cumulative adult/child totals including typed and restored drafts', () => {
    expect(salesRoomPartyError(state)).toBeNull();
    expect(
      salesRoomPartyError({
        ...state,
        hotel: {
          ...state.hotel,
          rooms: [rooms[0]!, { ...rooms[1]!, adults: 3 }],
        },
      }),
    ).toBeTruthy();
    expect(
      salesRoomPartyError({
        ...state,
        hotel: {
          ...state.hotel,
          rooms: [rooms[0]!, { ...rooms[1]!, childAges: [7, 8] }],
        },
      }),
    ).toBeTruthy();
    expect(
      salesRoomPartyError({
        ...state,
        passengerComposition: { adults: 5, children: 2, infants: 0 },
      }),
    ).toBeTruthy();
    expect(
      salesRoomPartyError({ ...state, serviceKinds: ['HOTEL'] }),
    ).toBeNull();
  });
  it('respects child and infant age bands instead of silently consuming extra flight adults', () => {
    expect(
      salesRoomPartyError({
        ...state,
        hotel: {
          ...state.hotel,
          rooms: [rooms[0]!, { ...rooms[1]!, childAges: [14] }],
        },
      }),
    ).toBeTruthy();
    expect(
      salesRoomPartyError({
        ...state,
        hotel: {
          ...state.hotel,
          rooms: [rooms[0]!, { ...rooms[1]!, childAges: [1] }],
        },
      }),
    ).toBeTruthy();
  });
  it('sums exact Decimal amounts and applies only the delta, preserving other services', () => {
    expect(roomAgreedTotals(rooms)).toEqual([
      { currencyCode: 'USD', amount: '100.35' },
    ]);
    const next = [
      { ...rooms[0]!, agreedPrice: { currencyCode: 'USD', amount: '70.25' } },
      rooms[1]!,
    ];
    const prices = withRoomPriceTotals(state, next);
    expect(prices).toEqual([
      { currencyCode: 'IRR', amount: '50000000' },
      { currencyCode: 'USD', amount: '130.35' },
    ]);
    expect(
      withRoomPriceTotals(
        {
          ...state,
          hotel: { ...state.hotel, rooms: next },
          contractPrices: prices,
        },
        next,
      ),
    ).toEqual(prices);
    expect(withRoomPriceTotals(state, rooms.slice(0, 1))[1]?.amount).toBe(
      '80.25',
    );
  });
  it('moves a changed room price between currencies without converting or duplicating it', () => {
    const next = [
      { ...rooms[0]!, agreedPrice: { currencyCode: 'EUR', amount: '55' } },
      rooms[1]!,
    ];
    expect(withRoomPriceTotals(state, next)).toEqual([
      { currencyCode: 'IRR', amount: '50000000' },
      { currencyCode: 'USD', amount: '60.1' },
      { currencyCode: 'EUR', amount: '55' },
    ]);
  });
});

it('retains hotel under15 children while consuming their correct flight age bands', () => {
  const state: SalesFormState = {
    ...emptySalesForm,
    serviceKinds: ['FLIGHT', 'HOTEL'],
    passengerComposition: { adults: 3, children: 1, infants: 0 },
    hotel: {
      ...emptySalesForm.hotel,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'family',
          roomTypeNameSnapshot: 'Family',
          adults: 2,
          childAges: [14, 5],
        },
      ],
    },
  };
  expect(salesRoomPartyError(state)).toBeNull();
});

it('rejects rooms below the flight party as well as above it', () => {
  expect(
    salesRoomPartyError({
      ...state,
      hotel: { ...state.hotel, rooms: [rooms[0]!] },
    }),
  ).toBeTruthy();
  expect(
    salesRoomPartyError({
      ...state,
      passengerComposition: { ...state.passengerComposition, adults: 7 },
    }),
  ).toBeTruthy();
  expect(
    salesRoomPartyError({
      ...state,
      hotel: {
        ...state.hotel,
        rooms: [rooms[0]!, { ...rooms[1]!, childAges: [] }],
      },
    }),
  ).toBeTruthy();
});

// Keep the dormant strict validation covered for an explicit future re-enable.
vi.mock('@nora/contracts', async (original) => ({
  ...(await original<typeof Contracts>()),
  enforceSalesHotelCapacity: () => true,
}));
