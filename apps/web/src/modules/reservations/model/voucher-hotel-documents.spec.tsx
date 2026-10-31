import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { voucherHotelDocuments } from './voucher-hotel-documents';
import { voucherServiceFixture } from './voucher-passenger-services.fixture';
import { voucherFormData } from './voucher-settings';
import { voucherPassengerServices } from './voucher-passenger-services';
import { VoucherFormSheet } from '../components/voucher-form-sheet';
import { reservationPdfHtml } from '../server/reservation-pdf-html';

function fixture(roomCount = 2) {
  const { intake, refs } = voucherServiceFixture();
  const hotel = intake.snapshot.hotelSelection!;
  hotel.rooms = [
    {
      ordinal: 1,
      roomTypeId: 'room',
      roomTypeNameSnapshot: 'PRIMARY DOUBLE',
      roomCategory: 'DOUBLE',
      adults: 2,
      childAges: [8],
    },
  ];
  hotel.additionalStays = [
    {
      hotelId: 'second',
      hotelNameSnapshot: 'SECOND HOTEL',
      cityId: 'second-city',
      checkInDate: '2026-11-04',
      checkOutDate: '2026-11-09',
      rooms: Array.from({ length: roomCount }, (_, i) => ({
        ordinal: i + 1,
        roomTypeId: i % 2 ? 'family' : 'single',
        roomTypeNameSnapshot: i % 2 ? 'SECOND FAMILY' : 'SECOND SINGLE',
        roomCategory: i % 2 ? 'FAMILY' : 'SINGLE',
        adults: i % 2 ? 3 : 1,
        childAges: i % 2 ? [8] : [],
      })),
    },
  ];
  for (const [id, name] of [
    ['second', 'SECOND HOTEL'],
    ['second-city', 'SECOND CITY'],
    ['single', 'SECOND SINGLE'],
    ['family', 'SECOND FAMILY'],
  ])
    refs[id!] = {
      id: id!,
      name: name!,
      attributes: { englishName: name! },
    } as unknown as (typeof refs)[string];
  // Saved primary room settings must not be copied into the second hotel's room list.
  intake.workflow.voucherSettings!.rooms = [
    {
      ordinal: 1,
      roomTypeNameSnapshot: 'PRIMARY OVERRIDE',
      adults: 2,
      childAges: [8],
    },
  ];
  return { intake, refs };
}
describe('composite hotel vouchers', () => {
  it('keeps every hotel city, dates and room composition independent without mutating the saved contract or voucher', () => {
    const { intake, refs } = fixture();
    const before = structuredClone(intake);
    const docs = voucherHotelDocuments(intake, refs);
    expect(docs).toHaveLength(2);
    const data = docs.map((d) => voucherFormData(d.intake, refs));
    expect(data[0]).toMatchObject({
      hotel: 'SAMPLE HOTEL',
      checkIn: '01 NOV 2026',
      checkOut: '04 NOV 2026',
    });
    expect(data[0]!.roomBreakdown[0]!.roomType).toContain('PRIMARY OVERRIDE');
    expect(data[1]).toMatchObject({
      hotel: 'SECOND HOTEL',
      destination: 'SECOND CITY',
      checkIn: '04 NOV 2026',
      checkOut: '09 NOV 2026',
      rooms: 2,
    });
    expect(data[1]!.roomBreakdown.map((r) => r.roomType)).toEqual([
      'SECOND SINGLE · Single',
      'SECOND FAMILY · Family',
    ]);
    expect(data[1]!.roomBreakdown.map((r) => [r.adults, r.childAges])).toEqual([
      [1, []],
      [3, [8]],
    ]);
    expect(data[1]!.passengers.map((p) => p.name)).not.toContain(
      'HIDDEN PASSENGER',
    );
    const services = voucherPassengerServices(docs[1]!.intake, data[1]!);
    expect(services.adult).toMatchObject({
      checkIn: '04 NOV 2026',
      checkOut: '09 NOV 2026',
      flightOut: 'YES',
      transferOut: 'YES',
    });
    expect(services.child).toMatchObject({
      checkIn: '04 NOV 2026',
      checkOut: '09 NOV 2026',
      different: false,
    });
    expect(services.flight).toMatchObject({ checkIn: '—', checkOut: '—' });
    expect(intake).toEqual(before);
  });
  it('prints the same hotels, rooms and services in preview and PDF with continuous appendix numbering', () => {
    const { intake, refs } = fixture(6);
    const pdf = reservationPdfHtml(intake, refs, '', '', true);
    const preview = renderToStaticMarkup(
      <VoucherFormSheet intake={intake} references={refs} logo="" voucher />,
    );
    for (const html of [preview, pdf]) {
      expect(html.match(/<article\b/g)).toHaveLength(3);
      for (const value of [
        'SAMPLE HOTEL',
        'SECOND HOTEL',
        'SECOND CITY',
        'PRIMARY OVERRIDE',
        'SECOND SINGLE',
        'SECOND FAMILY',
        'PASSENGER SERVICES',
        '04 NOV 2026',
        '09 NOV 2026',
        '1 / 3',
        '2 / 3',
        '3 / 3',
      ])
        expect(html).toContain(value);
      expect(html).not.toContain('HIDDEN PASSENGER');
      expect(html.match(/ROOM DETAILS/g)).toHaveLength(1);
    }
    expect(pdf.match(/<!doctype html>/gi)).toHaveLength(1);
    expect(pdf.match(/<body>/g)).toHaveLength(1);
    const hotelTwo = pdf.split('<article')[2]!;
    expect(hotelTwo).not.toContain('PRIMARY OVERRIDE');
    expect(hotelTwo).not.toContain('22 OCT 2026');
  });
  it('keeps single hotel and explicitly hotel-scoped outputs single, and omits hotel data when disabled', () => {
    const single = voucherServiceFixture();
    expect(voucherHotelDocuments(single.intake, single.refs)).toHaveLength(1);
    const { intake, refs } = fixture();
    const second = voucherHotelDocuments(intake, refs)[1]!.intake;
    expect(voucherHotelDocuments(second, refs)).toHaveLength(1);
    intake.workflow.voucherSettings!.flags.hotel = false;
    const html = reservationPdfHtml(intake, refs, '', '', true);
    expect(voucherHotelDocuments(intake, refs)).toHaveLength(1);
    expect(html).not.toContain('HOTEL INFORMATION');
    expect(html).not.toContain('PRIMARY OVERRIDE');
    expect(html).not.toContain('SECOND HOTEL');
  });
});

it('retains third-hotel ordering without saved settings and never borrows the primary room type for a historical stay without rooms', () => {
  const { intake, refs } = fixture();
  const second = intake.snapshot.hotelSelection!.additionalStays![0]!;
  intake.snapshot.hotelSelection!.additionalStays = [
    second,
    {
      ...second,
      hotelId: 'third',
      hotelNameSnapshot: 'THIRD HOTEL',
      checkInDate: '2026-11-09',
      checkOutDate: '2026-11-12',
    },
  ];
  delete intake.workflow.voucherSettings;
  const docs = voucherHotelDocuments(intake, refs);
  expect(docs.map((d) => voucherFormData(d.intake, refs).hotel)).toEqual([
    'SAMPLE HOTEL',
    'SECOND HOTEL',
    'THIRD HOTEL',
  ]);
  expect(voucherFormData(docs[2]!.intake, refs).checkIn).toBe('09 NOV 2026');
  const historical = fixture();
  const missing = {
    ...historical.intake.snapshot.hotelSelection!.additionalStays![0]!,
  };
  delete missing.rooms;
  historical.intake.snapshot.hotelSelection!.additionalStays = [missing];
  const oldData = voucherFormData(
    voucherHotelDocuments(historical.intake, historical.refs)[1]!.intake,
    historical.refs,
  );
  expect(oldData.roomBreakdown).toEqual([]);
  expect(oldData.roomType).toBe('-');
});
