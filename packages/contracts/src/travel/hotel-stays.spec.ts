import { expect, it } from 'vitest';
import {
  hotelRoomQuotationTotal,
  reservationTransferPassengerLimit,
  assertReservationTransferCounts,
  reservationHotelStays,
  reservationHotelTransferKeys,
  scopeReservationHotel,
} from './hotel-stays';
import type { SalesReservationRequestV1 } from '../sales';
const snapshot = {
  passengerIds: ['p'],
  passengerAssignments: [
    { customerId: 'p', ageCategory: 'ADT', serviceClientKeys: ['h'] },
  ],
  serviceSelections: [
    { clientKey: 'h', kind: 'HOTEL' },
    { clientKey: 'out', kind: 'TRANSFER' },
  ],
  hotelSelection: {
    serviceClientKey: 'h',
    hotelId: 'first',
    hotelNameSnapshot: 'FIRST',
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-04',
    rooms: [
      { ordinal: 1, roomTypeNameSnapshot: 'DBL', adults: 2, childAges: [] },
    ],
    additionalStays: [
      {
        hotelId: 'second',
        hotelNameSnapshot: 'SECOND',
        checkInDate: '2026-11-04',
        checkOutDate: '2026-11-09',
        rooms: [
          {
            ordinal: 1,
            roomTypeNameSnapshot: 'FAMILY',
            adults: 2,
            childAges: [4],
          },
        ],
      },
    ],
  },
} as unknown as SalesReservationRequestV1;
it('projects each canonical stay and its own dates/rooms without mutating the source', () => {
  const original = JSON.parse(
      JSON.stringify(snapshot),
    ) as SalesReservationRequestV1,
    stays = reservationHotelStays(snapshot);
  const scoped = scopeReservationHotel(snapshot, stays[1]!.key);
  expect(scoped.hotelSelection).toMatchObject({
    hotelId: 'second',
    checkInDate: '2026-11-04',
    checkOutDate: '2026-11-09',
    rooms: [{ roomTypeNameSnapshot: 'FAMILY' }],
  });
  expect(scoped.passengerAssignments![0]!.serviceClientKeys).toEqual([
    stays[1]!.key,
  ]);
  expect(snapshot).toEqual(original);
  expect(() => scopeReservationHotel(snapshot, 'foreign')).toThrow();
  expect(reservationHotelTransferKeys(snapshot, 'h')).toEqual(['out']);
  expect(reservationHotelTransferKeys(snapshot, stays[1]!.key)).toEqual([
    'hotel-transfer:2:second',
  ]);
});
it('prices each room by P.P × dimensionless ratio × its own stay nights, rounding exactly', () => {
  expect(
    hotelRoomQuotationTotal(
      [
        { roomOrdinal: 1, baseAmount: '120', factor: '2.5' },
        { roomOrdinal: 2, baseAmount: '80', factor: '1.5' },
      ],
      3,
      [1, 2],
    ),
  ).toBe('1260');
  expect(
    hotelRoomQuotationTotal(
      [{ roomOrdinal: 1, baseAmount: '0', factor: '1' }],
      5,
      [1],
    ),
  ).toBe('0');
  expect(
    hotelRoomQuotationTotal(
      [{ roomOrdinal: 1, baseAmount: '0.0001', factor: '1.5' }],
      3,
      [1],
    ),
  ).toBe('0.0005');
  for (const rows of [
    [{ roomOrdinal: 1, baseAmount: '', factor: '1' }],
    [{ roomOrdinal: 1, baseAmount: '1', factor: '0' }],
    [{ roomOrdinal: 2, baseAmount: '1', factor: '1' }],
    [],
  ])
    expect(() => hotelRoomQuotationTotal(rows, 3, [1])).toThrow();
});

it('charges a combined round-trip fare once per passenger and rejects unequal leg counts', async () => {
  const { hotelTransferChargeableCount } = await import('./hotel-stays.js');
  expect(
    hotelTransferChargeableCount({ outbound: 2, returning: 2 }, true),
  ).toBe(2);
  expect(hotelTransferChargeableCount({ outbound: 2, returning: 2 })).toBe(4);
  expect(
    hotelTransferChargeableCount({ outbound: 0, returning: 0 }, true),
  ).toBe(0);
  expect(() =>
    hotelTransferChargeableCount({ outbound: 2, returning: 1 }, true),
  ).toThrow();
});

it('bounds each transfer leg by booked paying guests, excluding infants and the 2–6 band', () => {
  const source = structuredClone(
    snapshot,
  ) as unknown as SalesReservationRequestV1;
  source.hotelSelection!.rooms = [
    {
      ordinal: 1,
      roomTypeNameSnapshot: 'Family',
      adults: 2,
      childAges: [1, 2, 5, 6, 11],
    },
  ];
  const limit = reservationTransferPassengerLimit(source);
  expect(limit).toBe(4);
  expect(() =>
    assertReservationTransferCounts({ outbound: 4, returning: 4 }, limit),
  ).not.toThrow();
  expect(() =>
    assertReservationTransferCounts({ outbound: 5, returning: 0 }, limit),
  ).toThrow();
  expect(() =>
    assertReservationTransferCounts({ outbound: 0, returning: 5 }, limit),
  ).toThrow();
  expect(() =>
    assertReservationTransferCounts({ outbound: 0, returning: 0 }, limit),
  ).not.toThrow();
  expect(() =>
    assertReservationTransferCounts({ outbound: 1.5, returning: 0 }, limit),
  ).toThrow();
});

it('uses contract age bands when room occupancy is unavailable', () => {
  const source = {
    passengerIds: ['adult', 'young', 'older', 'infant'],
    passengerAssignments: [
      { customerId: 'adult', ageCategory: 'ADT' },
      { customerId: 'young', ageCategory: 'CHD', childAgeBand: 'AGE_2_6' },
      { customerId: 'older', ageCategory: 'CHD', childAgeBand: 'AGE_6_12' },
      { customerId: 'infant', ageCategory: 'INF' },
      { customerId: 'removed', ageCategory: 'ADT' },
    ],
    serviceSelections: [],
  } as unknown as SalesReservationRequestV1;
  expect(reservationTransferPassengerLimit(source)).toBe(2);
});
