import { packageTourSelectionBatch } from './selection-batch';
import { expect, it } from 'vitest';
import {
  buildHotelPackageCompositions,
  buildHotelOnlyPackageCompositions,
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
  PackageTourCostGridV1,
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
it('keeps footer prices out of hotel rows, including matching currency and fixed commission', () => {
  const calculation = {
    ...input.calculation,
    adultFlight: { amount: '10000', currencyCode: 'IRR' },
    childFlight: { amount: '5000', currencyCode: 'IRR' },
    infantFlight: { amount: '900', currencyCode: 'IRR' },
    businessUplift: { amount: '500', currencyCode: 'EUR' },
    businessCabin: true,
    commissionMode: 'fixed' as const,
    commissionAmount: { amount: '700', currencyCode: 'IRR' },
    extraSaleFields: [{ amount: '25', currencyCode: 'EUR' }],
    flightCosts: [
      { adultUnitCost: '99', childUnitCost: '50', currencyCode: 'IRR' },
    ],
  };
  const before = JSON.stringify(calculation);
  const prices = buildHotelOnlyPackageCompositions({ ...input, calculation });
  expect(prices[0]?.currencyAmounts).toEqual([
    {
      currencyCode: 'EUR',
      priceBasis: 'HOTEL_ONLY',
      purchase: '200.00',
      sale: '220.00',
      commission: '0.00',
      profit: '20.00',
    },
  ]);
  expect(
    buildHotelOnlyPackageCompositions({
      ...input,
      calculation: {
        ...calculation,
        commissionMode: 'percent',
        commissionPercent: '10',
      },
    }),
  ).toEqual(prices);
  expect(JSON.stringify(calculation)).toBe(before);
});
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

it('keeps exact rows from every matching period and retains legacy single-batch scope on demand', () => {
  const a = { id: 'a', branchId: 'branch', rows: [{ id: 'ra', batchId: 'a' }] },
    b = { id: 'b', branchId: 'branch', rows: [{ id: 'rb', batchId: 'b' }] },
    other = { id: 'other', branchId: 'other', rows: [{ id: 'private' }] };
  const grid = {
    purchaseBatches: [a, b, other],
  } as unknown as PackageTourCostGridV1;
  const selected = packageTourSelectionBatch(grid, 'a');
  expect(selected?.id).toBe('a');
  expect(selected?.rows.map((r) => [r.id, r.batchId])).toEqual([
    ['ra', 'a'],
    ['rb', 'b'],
  ]);
  expect(packageTourSelectionBatch(grid, 'a', false)).toBe(a);
});

it('splits hotel bands at flight age boundaries and charges infant and child fares independently', () => {
  const infantRow = {
    ...row,
    roomRates: [
      {
        ...row.roomRates[0]!,
        occupancyRates: [
          { ...rate, childAges: [{ min: 0, maxExclusive: 15 }] },
        ],
      },
    ],
  };
  const rows = buildHotelPackageCompositions({
    ...input,
    row: infantRow,
    calculation: {
      ...input.calculation,
      infantFlight: { amount: '3', currencyCode: 'EUR' },
    },
  });
  expect(rows).toHaveLength(3);
  const infant = rows.find(
    (r) => packageRoomIdentity(r.roomCode)!.childAges[0]!.maxExclusive === 2,
  )!;
  const child = rows.find(
    (r) => packageRoomIdentity(r.roomCode)!.childAges[0]!.min === 2,
  )!;
  expect(
    infant.currencyAmounts.find((p) => p.currencyCode === 'EUR')!.sale,
  ).toBe('263.00');
  expect(
    child.currencyAmounts.find((p) => p.currencyCode === 'EUR')!.sale,
  ).toBe('270.00');
  const adult = rows.find(
    (r) => packageRoomIdentity(r.roomCode)!.childAges[0]!.min === 12,
  )!;
  expect(
    adult.currencyAmounts.find((p) => p.currencyCode === 'EUR')!.sale,
  ).toBe('280.00');
});
