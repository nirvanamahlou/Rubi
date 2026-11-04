import { expect, it } from 'vitest';
import { voucherServiceFixture } from './voucher-passenger-services.fixture';
import { voucherFormData } from './voucher-settings';
import {
  voucherPassengerServices,
  voucherPassengerCells,
  voucherServiceColumns,
  voucherPassengerPageUnits,
} from './voucher-passenger-services';
import { reservationPdfHtml } from '../server/reservation-pdf-html';
it('uses each selected passenger allocation and independent voucher dates, preserving custom stays and passport names', () => {
  const { intake, refs } = voucherServiceFixture();
  const before = structuredClone(intake);
  const data = voucherFormData(intake, refs);
  const services = voucherPassengerServices(intake, data);
  expect(data.passengers.map((p) => p.name)).toEqual([
    'CHILD PASSPORT',
    'ADULT PASSPORT',
    'FLIGHT ONLY',
  ]);
  expect(services.adult).toMatchObject({
    flightOut: 'YES',
    flightReturn: 'YES',
    transferOut: 'YES',
    transferReturn: 'YES',
    checkIn: '01 NOV 2026',
    checkOut: '04 NOV 2026',
    other: 'VISA',
    different: false,
  });
  expect(services.child).toMatchObject({
    flightOut: 'YES',
    flightReturn: '—',
    transferOut: '—',
    transferReturn: 'YES',
    checkIn: '22 OCT 2026',
    checkOut: '25 OCT 2026',
    different: true,
  });
  expect(services.flight).toMatchObject({
    flightOut: '—',
    flightReturn: 'YES',
    checkIn: '—',
    checkOut: '—',
    transferOut: '—',
    transferReturn: '—',
  });
  expect(services.hidden).toBeUndefined();
  expect(
    voucherPassengerCells(data.passengers[0]!, services.child!, 1),
  ).toContain('CHD (6-12)');
  expect(intake).toEqual(before);
});
it('honors disabled hotel/transfer flags without inventing allocations for legacy passengers', () => {
  const { intake, refs } = voucherServiceFixture();
  intake.workflow.voucherSettings!.flags.hotel = false;
  intake.workflow.voucherSettings!.flags.transfer = false;
  let rows = voucherPassengerServices(intake, voucherFormData(intake, refs));
  expect(rows.adult).toMatchObject({
    checkIn: '—',
    checkOut: '—',
    transferOut: '—',
    transferReturn: '—',
    flightOut: 'YES',
  });
  intake.snapshot.passengerAssignments = [];
  rows = voucherPassengerServices(intake, voucherFormData(intake, refs));
  expect(rows.adult).toMatchObject({ flightOut: '—', flightReturn: '—' });
});
it('prints the English service table and issuer without exposing prices, hidden passengers or Persian reference labels', () => {
  const { intake, refs } = voucherServiceFixture();
  const html = reservationPdfHtml(intake, refs, '', '', true);
  for (const [label] of voucherServiceColumns) expect(html).toContain(label);
  expect(voucherServiceColumns.reduce((n, c) => n + c[1], 0)).toBe(100);
  expect(html).toContain('PASSENGER SERVICES');
  expect(html).toContain('Jahan Bastan');
  expect(html).toContain('SAMPLE HOTEL');
  expect(html).toContain('SAMPLE CITY');
  expect(html).toContain('DOUBLE');
  expect(html).toContain('differentStay');
  expect(html).not.toContain('HIDDEN PASSENGER');
  expect(html).not.toContain('PROPOSED PURCHASE PRICE');
  expect(html.replace(/<style>[\s\S]*?<\/style>/g, '')).not.toMatch(
    /[\u0600-\u06ff]/,
  );
});

it('reserves space for detailed room tables and long notes without changing the selected passengers', () => {
  const { intake, refs } = voucherServiceFixture();
  const settings = intake.workflow.voucherSettings!;
  expect(voucherPassengerPageUnits(settings)).toBe(6);
  settings.rooms = Array.from({ length: 4 }, (_, i) => ({
    ordinal: i + 1,
    roomTypeNameSnapshot: 'ROOM',
    adults: 1,
    childAges: [],
  }));
  expect(voucherPassengerPageUnits(settings)).toBe(4);
  expect(voucherPassengerPageUnits(settings, 'Long note '.repeat(100))).toBe(2);
  const html = reservationPdfHtml(
    intake,
    refs,
    '',
    '',
    true,
    '',
    'https://example.test/d/' + 'a'.repeat(32),
  );
  expect(html).toContain('data-public-document-qr');
  expect(html).not.toMatch(/[\u0600-\u06ff]/);
});
