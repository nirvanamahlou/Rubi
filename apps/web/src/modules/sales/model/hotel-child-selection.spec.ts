import { expect, it } from 'vitest';
import {
  emptySalesForm,
  salesHotelCapacityError,
  salesPayload,
  type SalesFormState,
} from './sales-form';
import {
  selectHotelChild,
  syncHotelChildSelections,
  hotelChildChoices,
} from './hotel-child-selection';
import { salesRoomPartyError } from './sales-room-prices';
const date = '2026-10-01';
function draft(): SalesFormState {
  return {
    ...emptySalesForm,
    customerId: '10000000-0000-4000-8000-000000000001',
    originId: '10000000-0000-4000-8000-000000000002',
    destinationId: '10000000-0000-4000-8000-000000000003',
    departureDate: date,
    serviceKinds: ['FLIGHT', 'HOTEL'],
    contractFlights: {
      OUTBOUND: {
        departureAt: date + 'T06:00:00Z',
        arrivalAt: date + 'T08:00:00Z',
        carrierName: 'SYNTHETIC AIR',
        serviceNumber: 'SYN1',
        cabinClassCode: 'ECONOMY',
      },
    },
    passengerComposition: { adults: 2, children: 2, infants: 0 },
    childAges: [5, 7],
    hotel: {
      ...emptySalesForm.hotel,
      hotelId: 'hotel',
      name: 'SYNTHETIC HOTEL',
      checkIn: date,
      checkOut: '2026-10-05',
      guestCustomerIds: undefined,
      rooms: [
        {
          ordinal: 1,
          roomTypeId: '10000000-0000-4000-8000-000000000099',
          roomTypeNameSnapshot: 'Family',
          adults: 1,
          childAges: [null],
        },
        {
          ordinal: 2,
          roomTypeId: '10000000-0000-4000-8000-000000000099',
          roomTypeNameSnapshot: 'Family',
          adults: 1,
          childAges: [null],
        },
      ],
    },
  };
}
it('selects the flight children independently and prevents duplicate selection across rooms, including same-age children', () => {
  let s = selectHotelChild(draft(), date, 1, 0, 'child:0');
  s = selectHotelChild(s, date, 2, 0, 'child:1');
  expect(s.hotel.rooms!.map((r) => r.childAges)).toEqual([[5], [7]]);
  expect(
    selectHotelChild(s, date, 2, 0, 'child:0').hotel.rooms!.map(
      (r) => r.childAges,
    ),
  ).toEqual([[5], [7]]);
  s = syncHotelChildSelections({ ...s, childAges: [6, 6] }, date);
  expect(s.hotel.rooms!.map((r) => r.childAges)).toEqual([[6], [6]]);
  expect(s.hotelChildAssignments).toEqual({
    '1': ['child:0'],
    '2': ['child:1'],
  });
  s = syncHotelChildSelections(
    {
      ...s,
      passengerComposition: { adults: 2, children: 1, infants: 0 },
      childAges: [6],
    },
    date,
  );
  expect(s.hotel.rooms![1]!.childAges).toEqual([null]);
});
it('refreshes linked hotel ages from confirmed birthdates and clears the original mismatch without changing birthdays', () => {
  let s = selectHotelChild(draft(), date, 1, 0, 'child:0');
  s = selectHotelChild(s, date, 2, 0, 'child:1');
  s = {
    ...s,
    passengers: [
      { customerId: 'a', displayName: 'ADULT ONE', birthDate: '1990-01-01' },
      { customerId: 'b', displayName: 'ADULT TWO', birthDate: '1991-01-01' },
      { customerId: 'c', displayName: 'CHILD ONE', birthDate: '2020-01-01' },
      { customerId: 'd', displayName: 'CHILD TWO', birthDate: '2018-01-01' },
    ],
  };
  const next = syncHotelChildSelections(s, date);
  expect(next.childAges).toEqual([6, 8]);
  expect(next.hotel.rooms!.map((r) => r.childAges)).toEqual([[6], [8]]);
  expect(next.passengers).toEqual(s.passengers);
  expect(salesHotelCapacityError(next, [])).toBeNull();
  const payload = salesPayload({
    ...next,
    priceComponents: [
      { type: 'BASE', title: 'Synthetic', amount: '100', currencyCode: 'USD' },
    ],
  });
  expect(payload.hotelSelection!.rooms!.map((r) => r.childAges)).toEqual([
    [6],
    [8],
  ]);
  expect(JSON.stringify(payload)).not.toContain('hotelChildAssignments');
});
it('keeps the airline child band when a birthday between departure and check-in makes the hotel age12', () => {
  let s = draft();
  s = {
    ...s,
    passengerComposition: { adults: 2, children: 1, infants: 0 },
    childAges: [11],
    hotel: {
      ...s.hotel,
      checkIn: '2026-10-03',
      rooms: [{ ...s.hotel.rooms![0]!, adults: 2, childAges: [11] }],
    },
    passengers: [
      { customerId: 'a', displayName: 'A', birthDate: '1990-01-01' },
      { customerId: 'b', displayName: 'B', birthDate: '1991-01-01' },
      { customerId: 'c', displayName: 'C', birthDate: '2014-10-02' },
    ],
  };
  s = syncHotelChildSelections(s, date);
  expect(s.hotel.rooms![0]!.childAges).toEqual([12]);
  expect(s.childAges).toEqual([11]);
  expect(salesRoomPartyError(s)).toBeNull();
  expect(salesHotelCapacityError(s, [])).toBeNull();
});
it('does not invent ages or hide real capacity errors and preserves hotel-only editing', () => {
  const s = draft();
  expect(
    selectHotelChild({ ...s, childAges: [null, 7] }, date, 1, 0, 'child:0')
      .hotel.rooms![0]!.childAges,
  ).toEqual([null]);
  expect(hotelChildChoices(s, date).map((c) => c.label)).toEqual([
    'کودک 1 · 5 سال',
    'کودک 2 · 7 سال',
  ]);
  expect(
    syncHotelChildSelections({ ...s, serviceKinds: ['HOTEL'] }, date).hotel,
  ).toEqual(s.hotel);
});
