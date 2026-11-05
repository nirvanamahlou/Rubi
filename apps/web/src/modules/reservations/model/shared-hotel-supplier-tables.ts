import { roomChildCounts } from './reservation-form';
import type {
  ReservationFormIntake,
  ReservationFormReferences,
} from './reservation-form';
import { sharedHotelSupplierScopes } from './shared-hotel-supplier-form';
import { supplierFormData } from './voucher-settings';
import { supplierPriceTableData } from './supplier-form-prices';

/** Shared by browser preview and the PDF renderer. No mixed-currency summation. */
export function sharedHotelSupplierTables(
  intake: ReservationFormIntake,
  refs: ReservationFormReferences,
) {
  const scopes = sharedHotelSupplierScopes(intake);
  if (scopes.length < 2) return [];
  const hotels: (string | number)[][] = [];
  const rooms: (string | number)[][] = [];
  const prices: (string | number)[][] = [];
  scopes.forEach((scope, index) => {
    const data = supplierFormData(scope, refs);
    const number = index + 1;
    hotels.push([
      number,
      data.hotel,
      data.destination,
      data.stars,
      data.meal,
      data.checkIn,
      data.checkOut,
    ]);
    if (data.roomBreakdown.length)
      rooms.push(
        ...data.roomBreakdown.map((room) => [
          number,
          room.ordinal,
          room.roomType,
          room.adults,
          roomChildCounts(room.childAges).twoToSix,
          roomChildCounts(room.childAges).sixToTwelve,
          room.adults + room.childAges.length,
        ]),
      );
    else rooms.push([number, '-', data.roomType, '-', '-', '-', '-']);
    const table = supplierPriceTableData(scope);
    if (scope.workflow.supplierFormSettings?.hotelRoomPrices) {
      prices.push(
        ...table.rows
          .filter(
            (row) =>
              (row[0] !== 'TRANSFER' && row[0] !== 'TRANSFER ROUND TRIP') ||
              Boolean(
                scope.workflow.supplierFormSettings?.supplierFormPrices
                  ?.transferPp,
              ),
          )
          .map((row) => [number, ...row]),
      );
    } else {
      // Legacy column quotes are display-only; do not invent a calculated room total.
      prices.push([
        number,
        '-',
        'HOTEL',
        table.values[0] ?? '-',
        table.values[1] ?? '-',
        '-',
        '-',
      ]);
      if (scope.workflow.supplierFormSettings?.supplierFormPrices?.transferPp)
        prices.push([
          number,
          '-',
          table.headers[2] ?? 'TRANSFER',
          table.values[2] ?? '-',
          '-',
          '-',
          '-',
        ]);
    }
  });
  return [
    {
      code: '03',
      widths: [6, 29, 14, 6, 11, 17, 17],
      title: 'HOTEL INFORMATION',
      note: 'Accommodation',
      headers: [
        'HOTEL #',
        'HOTEL',
        'CITY',
        'STAR',
        'SERVICE',
        'CHECK-IN',
        'CHECK-OUT',
      ],
      rows: hotels,
    },
    {
      code: '03R',
      widths: [6, 7, 35, 10, 16, 16, 10],
      title: 'ROOM DETAILS',
      note: 'Room quantities by hotel',
      headers: [
        'HOTEL #',
        'ROOM',
        'ROOM TYPE',
        'ADULTS',
        'CHILDREN 2-6',
        'CHILDREN 6-12',
        'GUESTS',
      ],
      rows: rooms,
    },
    {
      code: '03P',
      widths: [6, 7, 30, 17, 9, 9, 22],
      title: 'PURCHASE PRICES',
      note: 'Supplier quotation',
      headers: [
        'HOTEL #',
        'ROOM',
        'ROOM TYPE / SERVICE',
        'Hotel P.P / Transfer P.P',
        'Ratio / COUNT',
        'NIGHTS',
        'PROPOSED PURCHASE',
      ],
      rows: prices,
    },
  ];
}
