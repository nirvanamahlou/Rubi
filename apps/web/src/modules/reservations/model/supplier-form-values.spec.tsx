import { afterEach, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReservationFormSheet } from '../components/reservation-form-sheet';
import { reservationPdfHtml } from '../server/reservation-pdf-html';
import { voucherServiceFixture } from './voucher-passenger-services.fixture';
import {
  defaultSupplierFormSettings,
  supplierFormData,
} from './voucher-settings';
import { supplierDocumentScope } from './supplier-document-scope';
import { supplierPriceTableData } from './supplier-form-prices';

const originalZone = process.env.TZ;
afterEach(() => {
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
});

it.each(['Asia/Tehran', 'UTC', 'America/Los_Angeles'])(
  'keeps contract flight calendar dates at midnight in %s through defaults and both outputs',
  (zone) => {
    process.env.TZ = zone;
    const { intake, refs } = voucherServiceFixture();
    intake.snapshot.ticketSelections = [
      {
        serviceClientKey: 'flight-out',
        direction: 'OUTBOUND',
        departureAt: '2026-10-20T21:00:00Z',
        arrivalAt: '2026-10-21T01:00:00Z',
        carrierNameSnapshot: 'TEST AIR',
        serviceNumberSnapshot: 'TEST-01',
      },
      {
        serviceClientKey: 'flight-return',
        direction: 'RETURN',
        departureAt: '2026-10-24T20:45:00Z',
        arrivalAt: '2026-10-25T01:00:00Z',
        carrierNameSnapshot: 'TEST AIR',
        serviceNumberSnapshot: 'TEST-02',
      },
    ] as never;
    delete intake.workflow.voucherSettings;
    const before = JSON.stringify(intake.snapshot);
    const settings = defaultSupplierFormSettings(intake, refs);
    expect(settings.text.arrivalDate).toBe('2026-10-21');
    expect(settings.text.departureDate).toBe('2026-10-25');
    intake.workflow.supplierFormSettings = settings;
    expect(
      supplierFormData(intake, refs).flights.map((f) => [f.date, f.time]),
    ).toEqual([
      ['21 OCT 2026', '00:30'],
      ['25 OCT 2026', '00:15'],
    ]);
    for (const html of [
      renderToStaticMarkup(
        <ReservationFormSheet
          intake={intake}
          references={refs}
          logo="/logo.png"
        />,
      ),
      reservationPdfHtml(intake, refs, 'data:image/png;base64,AAAA', ''),
    ]) {
      expect(html).toContain('21 OCT 2026');
      expect(html).toContain('25 OCT 2026');
    }
    expect(JSON.stringify(intake.snapshot)).toBe(before);
  },
);

it('defaults transfer quantities and marks to allocated passengers and preserves explicit deselection', () => {
  const { intake, refs } = voucherServiceFixture();
  delete intake.workflow.voucherSettings;
  const settings = defaultSupplierFormSettings(intake, refs);
  expect(settings.hotelTransferCounts).toEqual({ outbound: 1, returning: 2 });
  intake.workflow.supplierFormSettings = settings;
  expect(
    supplierFormData(intake, refs).passengers.find((p) => p.id === 'adult'),
  ).toMatchObject({ outboundTransfer: true, returnTransfer: true });
  const adult = settings.passengers.find((p) => p.id === 'adult')!;
  adult.services = { outboundTransfer: false } as never;
  expect(
    supplierFormData(intake, refs).passengers.find((p) => p.id === 'adult'),
  ).toMatchObject({ outboundTransfer: false, returnTransfer: true });
  expect(
    defaultSupplierFormSettings(intake, refs).passengers.find(
      (p) => p.id === 'adult',
    )!.services,
  ).toMatchObject({ outboundTransfer: false, returnTransfer: true });
});

it('bounds initial transfer quantities to the declared contract count and keeps saved zero quantities', () => {
  const { intake, refs } = voucherServiceFixture();
  delete intake.workflow.voucherSettings;
  intake.snapshot.serviceSelections.find(
    (s) => s.clientKey === 'transfer-return',
  )!.metadata = { direction: 'RETURN', passengerCount: 1 };
  const settings = defaultSupplierFormSettings(intake, refs);
  expect(settings.hotelTransferCounts).toEqual({ outbound: 1, returning: 1 });
  settings.hotelTransferCounts = { outbound: 0, returning: 0 };
  settings.text.arrivalDate = '2026-11-06';
  intake.workflow.supplierFormSettings = settings;
  expect(defaultSupplierFormSettings(intake, refs).hotelTransferCounts).toEqual(
    { outbound: 0, returning: 0 },
  );
  expect(defaultSupplierFormSettings(intake, refs).text.arrivalDate).toBe(
    '2026-11-06',
  );
});

it('prints entered legacy prices, ratio and exact totals without using contract or historical purchase amounts', () => {
  const { intake, refs } = voucherServiceFixture();
  delete intake.workflow.voucherSettings;
  const settings = defaultSupplierFormSettings(intake, refs);
  settings.supplierFormPrices = {
    pp: { amount: '100.25', currencyCode: 'EUR' },
    ratio: { amount: '2.5' },
    transferPp: { amount: '10.1', currencyCode: 'EUR' },
  };
  settings.hotelPurchasePrices = [{ amount: '999999', currencyCode: 'EUR' }];
  intake.workflow.supplierFormSettings = settings;
  const before = JSON.stringify(intake.snapshot);
  const table = supplierPriceTableData(intake);
  expect(table.values).toEqual(['100.25 EUR', '2.5', '10.1 EUR']);
  expect(table.rows).toContainEqual(['HOTEL TOTAL', '3 NIGHTS', '751.875 EUR']);
  expect(table.rows).toContainEqual(['TRANSFER TOTAL', '3 PAX', '30.3 EUR']);
  expect(table.rows.at(-1)).toEqual(['TOTAL', '', '782.175 EUR']);
  for (const html of [
    renderToStaticMarkup(
      <ReservationFormSheet
        intake={intake}
        references={refs}
        logo="/logo.png"
      />,
    ),
    reservationPdfHtml(intake, refs, 'data:image/png;base64,AAAA', ''),
  ]) {
    expect(html).toContain('782.175 EUR');
    expect(html).not.toContain('999999');
  }
  expect(JSON.stringify(intake.snapshot)).toBe(before);
  settings.supplierFormPrices.transferPp!.currencyCode = 'USD';
  expect(supplierPriceTableData(intake).rows.slice(-2)).toEqual([
    ['TOTAL', '', '751.875 EUR'],
    ['TOTAL', '', '30.3 USD'],
  ]);
});

it('totals multiple entered room quotations and suppresses incomplete currency subtotals', () => {
  const { intake, refs } = voucherServiceFixture();
  const settings = defaultSupplierFormSettings(intake, refs);
  settings.hotelRoomPrices = {
    currencyCode: 'EUR',
    rooms: [
      { roomOrdinal: 1, baseAmount: '9007199254740993.25', factor: '1' },
      { roomOrdinal: 2, baseAmount: '0.0001', factor: '1' },
    ],
  };
  settings.supplierFormPrices = {
    transferPp: { amount: '0', currencyCode: 'EUR' },
  };
  intake.workflow.supplierFormSettings = settings;
  expect(supplierPriceTableData(intake).rows.at(-1)).toEqual([
    'TOTAL',
    '',
    '',
    '',
    '',
    '27021597764222979.7503 EUR',
  ]);
  settings.hotelRoomPrices.rooms[1]!.baseAmount = '';
  expect(supplierPriceTableData(intake).rows.at(-1)).toEqual([
    'TOTAL',
    '',
    '',
    '',
    '',
    '- EUR',
  ]);
});

it('shows the contract tour guide in top services, removes the other-services column, and prints entered room base/factor in both outputs', () => {
  const { intake, refs } = voucherServiceFixture();
  intake.snapshot.serviceSelections = [
    ...intake.snapshot.serviceSelections,
    {
      clientKey: 'tour-guide',
      kind: 'OTHER',
      titleSnapshot: 'راهنما',
      metadata: { additionalServiceRole: 'TOUR_GUIDE' },
    } as never,
  ];
  delete intake.workflow.voucherSettings;
  const settings = defaultSupplierFormSettings(intake, refs);
  expect(settings.flags.tourLeader).toBe(true);
  // Existing revisions may predate recognition of the contract guide.
  settings.flags.tourLeader = false;
  settings.hotelRoomPrices = {
    currencyCode: 'EUR',
    rooms: [{ roomOrdinal: 1, baseAmount: '123.4567', factor: '2.5' }],
  };
  intake.workflow.supplierFormSettings = settings;
  expect(supplierFormData(intake, refs).services).toContain('TOUR LEADER');
  for (const html of [
    renderToStaticMarkup(
      <ReservationFormSheet
        intake={intake}
        references={refs}
        logo="/logo.png"
      />,
    ),
    reservationPdfHtml(intake, refs, 'data:image/png;base64,AAAA', ''),
  ]) {
    expect(
      html.slice(
        html.indexOf('SERVICES</span>'),
        html.indexOf('HOTEL INFORMATION'),
      ),
    ).toContain('TOUR LEADER');
    expect(html).not.toContain('OTHER SERVICES');
    expect(html).toContain('123.4567 EUR');
    expect(html).toMatch(/>2\.5<\/td>/);
    expect(html).toContain('925.9253 EUR');
  }
  settings.hotelTransferSeparate = true;
  expect(
    supplierFormData(supplierDocumentScope(intake, 'TRANSFER'), refs).services,
  ).not.toContain('TOUR LEADER');
});
