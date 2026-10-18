import { expect, it } from 'vitest';
import {
  buildHotelPackageCompositions,
  packageRoomCode,
  packageRoomIdentity,
} from './room-compositions';
import {
  matchingPublishedRooms,
  publishedSaleTotals,
} from './published-sale-quote';
import type {
  PackageTourHotelPurchaseRowV1,
  PackagePublishedSaleV1,
} from './index';
const rate = {
  adults: 2,
  childAges: [],
  startsOn: '2026-10-01',
  endsOnExclusive: '2026-10-05',
  amount: '100',
  currencyCode: 'EUR',
  composition: 'DBL',
  board: 'BB',
};
const row: PackageTourHotelPurchaseRowV1 = {
  id: 'row',
  version: 1,
  batchId: 'batch',
  hotelId: 'hotel',
  hotelName: 'Hotel',
  brokerId: 'broker',
  brokerName: 'Broker',
  basePerNight: '0',
  currencyCode: 'EUR',
  factors: {},
  roomRates: ['standard', 'deluxe'].map((roomTypeId, i) => ({
    roomTypeId,
    roomTypeName: roomTypeId,
    factor: '1',
    maxAdults: 2,
    maxChildren: 0,
    occupancyRates: [{ ...rate, amount: i ? '150' : '100' }],
  })),
};
const input = {
  row,
  checkIn: '2026-10-01',
  checkOut: '2026-10-03',
  currencyCode: 'EUR',
  calculation: {
    adjustment: {
      direction: 'increase' as const,
      mode: 'percent' as const,
      value: '10',
    },
    adultFlight: { amount: '20', currencyCode: 'EUR' },
    childFlight: { amount: '10', currencyCode: 'EUR' },
    businessUplift: { amount: '0', currencyCode: 'EUR' },
    businessCabin: false,
    commissionPercent: '0',
  },
};
it('keeps every exact room instead of replacing deluxe with the cheapest room', () => {
  const prices = buildHotelPackageCompositions(input);
  expect(prices).toHaveLength(2);
  expect(prices.map((p) => p.hotelPurchase)).toEqual(['200.00', '300.00']);
  expect(prices.map((p) => p.currencyAmounts[0]?.sale)).toEqual([
    '260.00',
    '370.00',
  ]);
  expect(new Set(prices.map((p) => p.roomCode)).size).toBe(2);
});
it('refuses missing nights without inventing a capacity tariff', () => {
  expect(
    buildHotelPackageCompositions({ ...input, checkOut: '2026-10-07' }),
  ).toEqual([]);
});
it('round trips room identity and matches exact ages, room and stay', () => {
  const identity = {
    roomTypeId: 'room',
    adults: 2,
    childAges: [
      { min: 2, maxExclusive: 6 },
      { min: 6, maxExclusive: 12 },
    ],
    board: 'BB',
  };
  const code = packageRoomCode(identity);
  expect(packageRoomIdentity(code)).toEqual(identity);
  const sale: PackagePublishedSaleV1 = {
    publicationId: 'pub',
    hotelId: 'hotel',
    hotelName: 'Hotel',
    roomTypeName: 'Room',
    roomCode: code,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    prices: [{ currencyCode: 'EUR', amount: '123.45' }],
  };
  const request = {
    hotelId: 'hotel',
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    roomTypeId: 'room',
    adults: 2,
    childAges: [8, 3],
  };
  expect(matchingPublishedRooms([sale], request)).toEqual([sale]);
  expect(
    matchingPublishedRooms([sale], { ...request, childAges: [12, 3] }),
  ).toEqual([]);
  expect(
    matchingPublishedRooms([sale], { ...request, roomTypeId: 'other' }),
  ).toEqual([]);
  expect(
    matchingPublishedRooms([sale], { ...request, checkOut: '2026-10-04' }),
  ).toEqual([]);
});
it('sums publication prices exactly and keeps currencies separate', () => {
  expect(
    publishedSaleTotals([
      {
        prices: [
          { currencyCode: 'IRR', amount: '9007199254740993' },
          { currencyCode: 'EUR', amount: '0.10' },
        ],
      },
      { prices: [{ currencyCode: 'EUR', amount: '0.20' }] },
    ]),
  ).toEqual([
    { currencyCode: 'EUR', amount: '0.30' },
    { currencyCode: 'IRR', amount: '9007199254740993' },
  ]);
});

it('keeps exact rows from every matching period and retains legacy single-batch scope on demand', async () => {
  const { packageTourSelectionBatch } = await import('./selection-batch');
  const a = { id: 'a', branchId: 'branch', rows: [{ id: 'ra', batchId: 'a' }] },
    b = { id: 'b', branchId: 'branch', rows: [{ id: 'rb', batchId: 'b' }] },
    other = { id: 'other', branchId: 'other', rows: [{ id: 'private' }] };
  const grid = {
    purchaseBatches: [a, b, other],
  } as unknown as import('./index').PackageTourCostGridV1;
  const selected = packageTourSelectionBatch(grid, 'a');
  expect(selected?.id).toBe('a');
  expect(selected?.rows.map((r) => [r.id, r.batchId])).toEqual([
    ['ra', 'a'],
    ['rb', 'b'],
  ]);
  expect(packageTourSelectionBatch(grid, 'a', false)).toBe(a);
});
