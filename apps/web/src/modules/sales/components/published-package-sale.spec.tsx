import { beforeEach, expect, it, vi } from 'vitest';
import type * as ReactModule from 'react';
import { packageRoomCode } from '@nora/contracts';
import { emptySalesForm, type SalesFormState } from '../model/sales-form';
import { PublishedPackageSale } from './published-package-sale';
const hooks = vi.hoisted(() => ({
  states: [] as unknown[],
  index: 0,
  effects: [] as (() => unknown)[],
  deps: [] as unknown[][],
  effectIndex: 0,
  fetch: vi.fn(),
}));
vi.mock('../api/client', () => ({
  salesApi: { publishedPackageSales: hooks.fetch },
}));
vi.mock('react', async (original) => ({
  ...(await original<typeof ReactModule>()),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.states))
      hooks.states[index] = typeof initial === 'function' ? initial() : initial;
    return [
      hooks.states[index],
      (next: unknown) => {
        hooks.states[index] =
          typeof next === 'function' ? next(hooks.states[index]) : next;
      },
    ];
  },
  useEffect: (effect: () => unknown, deps: unknown[]) => {
    const i = hooks.effectIndex++,
      before = hooks.deps[i];
    if (!before || deps.some((v, j) => v !== before[j])) {
      hooks.effects.push(effect);
      hooks.deps[i] = deps;
    }
  },
}));
let state: SalesFormState;
const onChange = (update: ReactModule.SetStateAction<SalesFormState>) => {
  state = typeof update === 'function' ? update(state) : update;
};
function render() {
  hooks.index = 0;
  hooks.effectIndex = 0;
  PublishedPackageSale({ state, onChange });
  const pending = hooks.effects.splice(0);
  pending.forEach((f) => f());
}
const price = {
  publicationId: 'pub',
  hotelId: 'hotel',
  hotelName: 'Hotel',
  roomTypeName: 'Standard',
  roomCode: packageRoomCode({
    roomTypeId: 'room',
    adults: 2,
    childAges: [],
    board: 'BB',
  }),
  checkIn: '2026-10-01',
  checkOut: '2026-10-03',
  prices: [
    { currencyCode: 'EUR', amount: '200.00' },
    { currencyCode: 'IRR', amount: '1000' },
  ],
};
beforeEach(() => {
  hooks.states = [];
  hooks.deps = [];
  hooks.effects = [];
  hooks.fetch.mockReset();
  hooks.fetch.mockResolvedValue({ data: [price] });
  state = {
    ...emptySalesForm,
    tour: { id: 'tour' } as SalesFormState['tour'],
    hotel: {
      ...emptySalesForm.hotel,
      hotelId: 'hotel',
      checkIn: '2026-10-02',
      checkOut: '2026-10-02',
      checkInManual: false,
      checkOutManual: false,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'room',
          roomTypeNameSnapshot: 'Standard',
          adults: 2,
          childAges: [],
        },
      ],
    },
  };
});
it('fills the exact published composition, keeps later negotiated amounts, and removes stale quotes when occupancy changes', async () => {
  render();
  await Promise.resolve();
  render();
  render();
  expect(state.hotel.checkIn).toBe(price.checkIn);
  expect(state.hotel.checkOut).toBe(price.checkOut);
  expect(state.packageSaleQuote?.items[0]?.publicationId).toBe('pub');
  expect(state.contractPrices).toEqual([
    { currencyCode: 'EUR', amount: '200.00' },
    { currencyCode: 'IRR', amount: '1000' },
  ]);
  expect(state.hotel.rooms?.[0]?.agreedPrice).toEqual({
    currencyCode: 'EUR',
    amount: '200.00',
  });
  state = {
    ...state,
    contractPrices: [{ currencyCode: 'EUR', amount: '180.00' }],
  };
  render();
  expect(state.contractPrices?.[0]?.amount).toBe('180.00');
  state = {
    ...state,
    hotel: {
      ...state.hotel,
      rooms: state.hotel.rooms!.map((r) => ({ ...r, adults: 1 })),
    },
  };
  render();
  render();
  expect(state.packageSaleQuote).toBeUndefined();
  expect(state.contractPrices?.[0]?.amount).toBe('180.00');
});

it('preserves explicitly manual hotel dates instead of silently quoting a different stay', async () => {
  state = {
    ...state,
    hotel: { ...state.hotel, checkInManual: true, checkOutManual: true },
  };
  render();
  await Promise.resolve();
  render();
  render();
  expect(state.hotel.checkIn).toBe('2026-10-02');
  expect(state.packageSaleQuote).toBeUndefined();
});

it('automatically switches the published total for the selected hotel and exact adult/child composition', async () => {
  const family = {
    ...price,
    publicationId: 'family',
    roomCode: packageRoomCode({
      roomTypeId: 'room',
      adults: 2,
      childAges: [{ min: 2, maxExclusive: 6 }],
      board: 'BB',
    }),
    prices: [
      { currencyCode: 'EUR', amount: '260.00' },
      { currencyCode: 'IRR', amount: '1250' },
    ],
  };
  hooks.fetch.mockResolvedValue({
    data: [
      price,
      family,
      {
        ...family,
        hotelId: 'other',
        prices: [{ currencyCode: 'EUR', amount: '999' }],
      },
    ],
  });
  render();
  await Promise.resolve();
  render();
  render();
  expect(state.contractPrices).toEqual(price.prices);
  state = {
    ...state,
    contractPrices: [{ currencyCode: 'EUR', amount: '180' }],
    hotel: {
      ...state.hotel,
      rooms: state.hotel.rooms!.map((r) => ({ ...r, childAges: [4] })),
    },
  };
  render();
  render();
  expect(state.packageSaleQuote?.items[0]?.publicationId).toBe('family');
  expect(state.contractPrices).toEqual(family.prices);
  expect(state.passengerTotalPricing).toBe(false);
  expect(state.passengerHotelPrices).toBeUndefined();
  state = {
    ...state,
    hotel: {
      ...state.hotel,
      rooms: state.hotel.rooms!.map((r) => ({ ...r, childAges: [8] })),
    },
  };
  render();
  render();
  expect(state.packageSaleQuote).toBeUndefined();
});

it('does not replace outbound-day check-in with a next-day published package stay', async () => {
  state = {
    ...state,
    serviceKinds: ['FLIGHT', 'HOTEL'],
    departureDate: '2026-09-30',
    hotelArrivesNextDay: true,
  };
  render();
  await Promise.resolve();
  render();
  render();
  expect(state.hotel.checkIn).toBe('2026-09-30');
  expect(state.hotel.checkOut).toBe(price.checkOut);
  expect(state.packageSaleQuote).toBeUndefined();
});
