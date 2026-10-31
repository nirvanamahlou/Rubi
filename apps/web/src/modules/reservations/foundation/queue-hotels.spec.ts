import { expect, it } from 'vitest';
import { queueHotelName, queueHotels } from './queue-hotels';
import { reservationColumns, reservationExportRows } from './reservation-table';
import { defaultQuery, queryRows, type RequestView } from './model';

it('keeps every hotel in itinerary order through partial English-name resolution, search and export', () => {
  const source = {
    hotelId: 'first',
    hotelName: 'FIRST SNAPSHOT / SECOND SNAPSHOT / THIRD SNAPSHOT',
    hotels: [
      { hotelId: 'first', name: 'FIRST SNAPSHOT' },
      { hotelId: 'second', name: 'SECOND SNAPSHOT' },
      { hotelId: 'third', name: 'THIRD SNAPSHOT' },
    ],
  };
  const before = structuredClone(source);
  const hotelName = queueHotelName(source, {
    'hotels:first': 'FIRST HOTEL',
    'hotels:third': 'THIRD HOTEL',
  });
  expect(hotelName).toBe('FIRST HOTEL / SECOND SNAPSHOT / THIRD HOTEL');
  const row = {
    ...source,
    hotelName,
    id: 'request',
    contractNumber: 'SYNTHETIC',
    customerName: '',
    salesCounter: '',
    passengerNames: [],
    services: [],
    status: 'NEW',
  } as unknown as RequestView;
  expect(
    queryRows([row], { ...defaultQuery, search: 'SECOND SNAPSHOT' })
      .filteredRows,
  ).toEqual([row]);
  expect(
    reservationExportRows([row])[1]?.[reservationColumns.indexOf('Hotel')],
  ).toBe(hotelName);
  expect(source).toEqual(before);
});

it('preserves single-hotel legacy rows, missing references and empty contracts without stray separators', () => {
  expect(
    queueHotelName(
      { hotelId: 'only', hotelName: 'Snapshot' },
      { 'hotels:only': 'HOTEL' },
    ),
  ).toBe('HOTEL');
  expect(queueHotelName({ hotelName: 'Snapshot' })).toBe('Snapshot');
  expect(queueHotelName({})).toBe('');
  expect(queueHotels({})).toEqual([]);
  expect(queueHotelName({ hotels: [{ name: ' ' }, { name: ' HOTEL ' }] })).toBe(
    'HOTEL',
  );
});
