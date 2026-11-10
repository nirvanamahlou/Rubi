import { expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  buildServiceReportWorkbook,
  reportGregorianTime,
} from './service-report-workbook';
import type { ServiceReportRow } from './service-report';

const row = (overrides: Partial<ServiceReportRow> = {}): ServiceReportRow => ({
  id: 'row',
  customerId: 'p1',
  contractNumber: '001234',
  passengerDisplayName: 'Same Name',
  ticketNumber: '00001',
  pnr: null,
  originCityId: 'a',
  origin: 'Origin',
  destinationCityId: 'b',
  destination: 'Destination',
  airlineId: 'c',
  airline: 'Airline',
  issuedAt: '2026-11-08T21:00:00Z',
  departureAt: '2026-11-09T21:00:00Z',
  arrivalAt: '2026-11-09T23:30:00Z',
  direction: 'RETURN',
  flightNumber: 'T1',
  cabinClass: 'ECONOMY',
  source: 'MANUAL',
  status: 'issued',
  serviceKind: 'FLIGHT',
  serviceTitle: 'Flight',
  hotelId: '',
  hotelName: '',
  checkInDate: '',
  checkOutDate: '',
  reportStatus: 'ISSUED',
  ...overrides,
});
const query = {
  issuedFrom: '2026-11-01',
  issuedTo: '2026-11-30',
  dateBasis: 'TRAVEL',
};
function sheet(rows: ServiceReportRow[]) {
  return strFromU8(
    unzipSync(buildServiceReportWorkbook(rows, query))[
      'xl/worksheets/sheet1.xml'
    ]!,
  );
}
it('counts identities across directions/services and keeps equal passenger names distinct', () => {
  const rows = [
    row(),
    row({ id: 'return' }),
    row({
      id: 'hotel',
      serviceKind: 'HOTEL',
      hotelId: 'h',
      hotelName: 'Hotel',
      checkInDate: '2026-11-10',
      checkOutDate: '2026-11-14',
      reportStatus: 'ALLOCATED',
    }),
    row({ id: 'other-passenger', customerId: 'p2', reportStatus: 'CANCELLED' }),
  ];
  const xml = sheet(rows);
  const cell = (ref: string, value: string) =>
    expect(xml).toContain(
      `<c r="${ref}" s="0" t="inlineStr"><is><t xml:space="preserve">${value}</t>`,
    );
  cell('B4', '2');
  cell('B5', '1');
  cell('B6', '4');
  cell('B7', '2');
  cell('B8', '1');
  cell('B9', '1');
  cell('C14', '2');
  cell('C17', '2');
  expect(xml).toContain('2026-11-10 00:30');
  expect(xml).toContain('2026-11-10 03:00');
  cell('T16', '2026-11-10');
  cell('U16', '2026-11-14');
  cell('V16', '4');
  expect(xml).toContain('تاریخ چک این هتل');
  expect(xml).toContain('تاریخ چک اوت هتل');
  expect(xml).not.toContain('<pane');
  expect(xml).toContain('autoFilter ref="A13:V17"');
  expect(xml).not.toContain('T21:00:00Z');
  expect(rows[0]?.departureAt).toBe('2026-11-09T21:00:00Z');
});
it('exports zero KPIs and a filterable header for empty results, preserving formula safety', () => {
  expect(sheet([])).toContain('autoFilter ref="A13:V13"');
  const xml = sheet([row({ passengerDisplayName: '=HYPERLINK("test")' })]);
  expect(xml).not.toContain('<f>');
  expect(xml).toContain('=HYPERLINK(&quot;test&quot;)');
  expect(xml).toContain('001234');
});
it('formats defined Gregorian local time across UTC midnight and preserves date-only stays', () => {
  expect(reportGregorianTime('2026-11-08T21:00:00Z')).toBe('2026-11-09 00:30');
  expect(reportGregorianTime('2026-11-09T00:30:00+03:30')).toBe(
    '2026-11-09 00:30',
  );
  expect(reportGregorianTime('2026-11-09')).toBe('2026-11-09');
  expect(reportGregorianTime('invalid')).toBe('');
  expect(reportGregorianTime('')).toBe('');
});
