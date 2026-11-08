import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HOTEL_JOURNEYS, type HotelJourneyV1 } from '@nora/contracts';
import { voucherServiceFixture } from './voucher-passenger-services.fixture';
import { voucherHotelDocuments } from './voucher-hotel-documents';
import { voucherHotelJourneyRows } from './voucher-hotel-journeys';
import { VoucherFormSheet } from '../components/voucher-form-sheet';
import { reservationPdfHtml } from '../server/reservation-pdf-html';

function fixture(mode: HotelJourneyV1['mode']) {
  const { intake, refs } = voucherServiceFixture();
  const first = intake.snapshot.hotelSelection!;
  first.additionalStays = [
    {
      hotelId: 'second',
      hotelNameSnapshot: 'SECOND HOTEL',
      cityId: 'second-city',
      checkInDate: '2026-11-04',
      checkOutDate: '2026-11-09',
    },
  ];
  const airport = {
    id: 'a',
    cityId: 'city',
    countryId: 'country',
    code: 'IST',
    name: 'Istanbul Airport',
  };
  const leg: HotelJourneyV1 = {
    fromHotelId: first.hotelId,
    toHotelId: 'second',
    mode,
    departureDate: '2026-11-03',
    departureTime: '23:30',
    arrivalTime: '01:00',
    ...(mode === 'FLIGHT'
      ? {
          flight: {
            airline: 'TEST AIR',
            number: 'XY123',
            cabinClass: 'BUSINESS',
            originAirport: airport,
            destinationAirport: {
              ...airport,
              id: 'b',
              code: 'AYT',
              name: 'Antalya Airport',
            },
          },
        }
      : {}),
  };
  intake.snapshot.serviceSelections.find((s) => s.kind === 'HOTEL')!.metadata =
    {
      [HOTEL_JOURNEYS]: JSON.stringify([leg]),
    };
  return { intake, refs };
}

it.each(['BUS', 'CAR', 'FLIGHT'] as const)(
  'shows the %s journey once on its own hotel voucher in preview and PDF',
  (mode) => {
    const { intake, refs } = fixture(mode);
    const before = structuredClone(intake);
    const docs = voucherHotelDocuments(intake, refs);
    expect(voucherHotelJourneyRows(docs[0]!.intake, refs)[0]).toEqual(
      expect.arrayContaining([
        mode,
        '03 NOV 2026 · 23:30',
        '04 NOV 2026 · 01:00',
      ]),
    );
    expect(voucherHotelJourneyRows(docs[0]!.intake, refs)[0]![0]).toContain(
      'SECOND HOTEL',
    );
    expect(voucherHotelJourneyRows(docs[1]!.intake, refs)).toEqual([]);
    for (const html of [
      renderToStaticMarkup(
        <VoucherFormSheet
          intake={intake}
          references={refs}
          logo="/logo.png"
          voucher
        />,
      ),
      reservationPdfHtml(intake, refs, 'data:image/png;base64,AA==', '', true),
    ]) {
      expect(html.match(/data-hotel-journeys/g)).toHaveLength(1);
      expect(html).toContain('HOTEL TRANSPORT');
      expect(html).toContain('23:30');
      expect(html).toContain('01:00');
      expect(html).not.toMatch(/[\u0600-\u06ff]/);
      if (mode === 'FLIGHT')
        for (const text of ['XY123', 'BUSINESS', 'IST', 'AYT'])
          expect(html).toContain(text);
    }
    expect(intake).toEqual(before);
  },
);

it('leaves no transport section when no journey exists or hotel output is disabled', () => {
  for (const disabled of [false, true]) {
    const { intake, refs } = fixture('BUS');
    if (disabled) intake.workflow.voucherSettings!.flags.hotel = false;
    else
      intake.snapshot.serviceSelections.find(
        (s) => s.kind === 'HOTEL',
      )!.metadata = {};
    for (const html of [
      renderToStaticMarkup(
        <VoucherFormSheet
          intake={intake}
          references={refs}
          logo="/logo.png"
          voucher
        />,
      ),
      reservationPdfHtml(intake, refs, 'data:image/png;base64,AA==', '', true),
    ]) {
      expect(html).not.toContain('HOTEL TRANSPORT');
      expect(html).not.toContain('data-hotel-journeys');
    }
  }
});
