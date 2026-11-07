import { expect, it } from 'vitest';
import {
  HOTEL_JOURNEYS,
  hotelJourneyArrivalDate,
  hotelJourneyError,
  readHotelJourneys,
  retainHotelJourneyRoutes,
  validateHotelJourneys,
  type HotelJourneyV1,
} from './hotel-journeys';
import type { SalesHotelSelectionInput } from './index';
const leg: HotelJourneyV1 = {
  fromHotelId: 'one',
  toHotelId: 'two',
  mode: 'BUS',
  departureDate: '2027-01-06',
  arrivalDate: '2027-01-07',
  departureTime: '23:00',
  arrivalTime: '05:00',
};
const hotel: SalesHotelSelectionInput = {
  serviceClientKey: 'hotel',
  hotelId: 'one',
  hotelNameSnapshot: 'First hotel',
  cityId: 'first-city',
  checkInDate: '2027-01-01',
  checkOutDate: '2027-01-03',
  roomCount: 1,
  roomTypeId: 'room',
  occupancy: 2,
  inventoryStatus: 'NEEDS_RESERVATION_CONFIRMATION',
  additionalStays: [
    {
      hotelId: 'two',
      hotelNameSnapshot: 'Second hotel',
      cityId: 'second-city',
      checkInDate: '2027-01-07',
      checkOutDate: '2027-01-09',
    },
  ],
};
const airport = {
  id: '10000000-0000-4000-8000-000000000001',
  cityId: '10000000-0000-4000-8000-000000000002',
  countryId: '10000000-0000-4000-8000-000000000003',
  code: 'IST',
  name: 'Istanbul',
};
it.each(['BUS', 'CAR', 'FLIGHT'] as const)(
  'accepts %s journeys without an arrival date, including overnight travel',
  (mode) => {
    const { arrivalDate: _legacyDate, ...rest } = leg;
    void _legacyDate;
    const journey: HotelJourneyV1 = {
      ...rest,
      mode,
      ...(mode === 'FLIGHT'
        ? {
            flight: {
              airline: 'Test Air',
              number: '123',
              cabinClass: 'ECONOMY',
              originAirport: airport,
              destinationAirport: {
                ...airport,
                id: '10000000-0000-4000-8000-000000000004',
                code: 'CDG',
              },
            },
          }
        : {}),
    };
    expect(hotelJourneyError(journey)).toBeUndefined();
    expect(hotelJourneyArrivalDate(journey)).toBe('2027-01-07');
    expect(() => validateHotelJourneys([journey], hotel)).not.toThrow();
    expect(
      hotelJourneyArrivalDate({ ...journey, departureTime: '03:00' }),
    ).toBe('2027-01-06');
  },
);
it('keeps journeys optional and permits independent dates several days after checkout and overnight travel', () => {
  expect(() => validateHotelJourneys([], undefined)).not.toThrow();
  expect(() => validateHotelJourneys([leg], hotel)).not.toThrow();
  expect(
    hotelJourneyError({ ...leg, arrivalDate: leg.departureDate }),
  ).toContain('بعد');
  expect(() =>
    validateHotelJourneys([{ ...leg, departureDate: '2027-01-02' }], hotel),
  ).toThrow('بین');
  expect(() =>
    validateHotelJourneys([{ ...leg, arrivalDate: '2027-01-08' }], hotel),
  ).toThrow('بین');
});
it('requires complete flight facts only for the selected flight mode', () => {
  expect(hotelJourneyError(leg)).toBeUndefined();
  expect(hotelJourneyError({ ...leg, mode: 'FLIGHT' })).toContain('ایرلاین');
  const flight = {
    airline: 'Different airline',
    number: 'X42',
    cabinClass: 'BUSINESS' as const,
    originAirport: airport,
    destinationAirport: {
      ...airport,
      id: '10000000-0000-4000-8000-000000000004',
      code: 'CDG',
    },
  };
  expect(hotelJourneyError({ ...leg, mode: 'FLIGHT', flight })).toBeUndefined();
  expect(hotelJourneyError({ ...leg, flight })).toContain('سازگار');
  expect(
    hotelJourneyError({
      ...leg,
      mode: 'FLIGHT',
      flight: { ...flight, destinationAirport: airport },
    }),
  ).toContain('فرودگاه');
});
it('keeps return transport on the last hotel and checks the actual return flight instant', () => {
  const returning: HotelJourneyV1 = {
    ...leg,
    fromHotelId: 'two',
    toHotelId: null,
    mode: 'CAR',
    airport,
    departureDate: '2027-01-09',
    arrivalDate: '2027-01-09',
    departureTime: '08:00',
    arrivalTime: '09:00',
  };
  expect(() =>
    validateHotelJourneys([returning], hotel, '2027-01-09T06:00:00Z'),
  ).not.toThrow();
  expect(() =>
    validateHotelJourneys([returning], hotel, '2027-01-09T05:30:00Z'),
  ).toThrow('قبل');
  expect(() =>
    validateHotelJourneys([{ ...returning, fromHotelId: 'one' }], hotel),
  ).toThrow('ترتیب');
  expect(
    retainHotelJourneyRoutes([leg, returning], ['one', 'two', 'three']),
  ).toEqual([leg]);
  expect(
    retainHotelJourneyRoutes([leg, returning], ['one', 'replacement']),
  ).toEqual([]);
  expect(() => validateHotelJourneys([leg, leg], hotel)).toThrow('ترتیب');
});
it('persists only hotel metadata and rejects malformed or misplaced snapshots', () => {
  expect(readHotelJourneys([])).toEqual([]);
  expect(
    readHotelJourneys([
      { kind: 'HOTEL', metadata: { [HOTEL_JOURNEYS]: JSON.stringify([leg]) } },
    ]),
  ).toEqual([leg]);
  for (const raw of [
    'not json',
    '{}',
    '[null]',
    JSON.stringify(Array(51).fill(leg)),
  ])
    expect(() =>
      readHotelJourneys([
        { kind: 'HOTEL', metadata: { [HOTEL_JOURNEYS]: raw } },
      ]),
    ).toThrow();
  expect(() =>
    readHotelJourneys([
      { kind: 'FLIGHT', metadata: { [HOTEL_JOURNEYS]: JSON.stringify([leg]) } },
    ]),
  ).toThrow();
});
