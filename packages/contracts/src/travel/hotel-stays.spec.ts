import { expect, it } from 'vitest';
import {
  hotelRoomQuotationTotal,
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
