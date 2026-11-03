import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { reservationHotelStays } from '@nora/contracts';
import { voucherServiceFixture } from './voucher-passenger-services.fixture';
import { defaultVoucherSettings } from './voucher-settings';
import { hotelFormScope } from './hotel-form-scope';
import { supplierDocumentScope } from './supplier-document-scope';
import { sharedHotelSupplierScopes } from './shared-hotel-supplier-form';
import { ReservationFormSheet } from '../components/reservation-form-sheet';
import { reservationPdfHtml } from '../server/reservation-pdf-html';
function fixture() {
  const { intake, refs } = voucherServiceFixture();
  intake.snapshot.hotelSelection!.additionalStays = [
    {
      hotelId: 'second',
      hotelNameSnapshot: 'SECOND HOTEL',
      cityId: 'second-city',
      checkInDate: '2026-11-04',
      checkOutDate: '2026-11-09',
      rooms: [
        {
          ordinal: 1,
          roomTypeId: 'second-room',
          roomTypeNameSnapshot: 'SECOND SINGLE',
          roomCategory: 'SINGLE',
          adults: 1,
          childAges: [],
        },
      ],
    },
  ];
  delete intake.workflow.voucherSettings;
  for (const stay of reservationHotelStays(intake.snapshot)) {
    const scoped = hotelFormScope(intake, stay.key);
    const settings = defaultVoucherSettings(scoped, refs);
    settings.brokerId = '11111111-1111-4111-8111-111111111111';
    settings.text.broker = 'COMMON SUPPLIER';
    settings.sharedHotelBroker = stay.ordinal === 1;
    settings.hotelPurchasePrices = [
      { amount: stay.ordinal === 1 ? '123' : '456', currencyCode: 'EUR' },
    ];
    settings.supplierFormPrices = {
      pp: { amount: stay.ordinal === 1 ? '123' : '456', currencyCode: 'EUR' },
    };
    intake.workflow.hotelSupplierForms = {
      ...intake.workflow.hotelSupplierForms,
      [stay.key]: {
        settings,
        sentSettings: structuredClone(settings),
        status: 'REQUESTED',
        sentVersion: 2,
      },
    };
    if (stay.ordinal === 1) intake.workflow.supplierFormSettings = settings;
  }
  return { intake, refs };
}
it('renders two independent hotel and price tables inside one preview and PDF form', () => {
  const { intake, refs } = fixture();
  const primary = hotelFormScope(
    intake,
    reservationHotelStays(intake.snapshot)[0]!.key,
  );
  const before = structuredClone(primary);
  const preview = renderToStaticMarkup(
    <ReservationFormSheet intake={primary} references={refs} logo="" />,
  );
  const pdf = reservationPdfHtml(
    primary,
    refs,
    'data:image/png;base64,AAAA',
    '',
  );
  for (const html of [preview, pdf]) {
    expect(html.match(/RESERVATION FORM/g)).toHaveLength(1);
    expect(html).toContain('SAMPLE HOTEL');
    expect(html).toContain('SECOND HOTEL');
    expect(html).toContain('04 NOV 2026');
    expect(html).toContain('09 NOV 2026');
    expect(html).toContain('123');
    expect(html).toContain('456');
    expect(html).toContain('SECOND SINGLE');
  }
  expect(sharedHotelSupplierScopes(primary)).toHaveLength(2);
  expect(primary).toEqual(before);
});
it('keeps independent hotels separate when grouping is off and retains sent prices after a draft changes', () => {
  const { intake } = fixture();
  const keys = reservationHotelStays(intake.snapshot).map((stay) => stay.key);
  const primary = hotelFormScope(intake, keys[0]!);
  primary.workflow.supplierFormSettings!.sharedHotelBroker = false;
  expect(sharedHotelSupplierScopes(primary)).toHaveLength(1);
  primary.workflow.supplierFormSettings =
    primary.workflow.sentSupplierFormSettings!;
  intake.workflow.hotelSupplierForms![
    keys[1]!
  ]!.settings!.supplierFormPrices!.pp!.amount = '999';
  const grouped = sharedHotelSupplierScopes(primary);
  expect(grouped).toHaveLength(2);
  expect(
    grouped[1]!.workflow.supplierFormSettings!.supplierFormPrices!.pp!.amount,
  ).toBe('456');
  expect(
    sharedHotelSupplierScopes(hotelFormScope(intake, keys[1]!)),
  ).toHaveLength(1);
});

it('uses sent hotel quotations even when the separate-transfer scope clones the primary settings', () => {
  const { intake } = fixture();
  const keys = reservationHotelStays(intake.snapshot).map((stay) => stay.key);
  const primary = hotelFormScope(intake, keys[0]!);
  primary.workflow.sentSupplierFormSettings!.hotelTransferSeparate = true;
  primary.workflow.supplierFormSettings =
    primary.workflow.sentSupplierFormSettings!;
  primary.workflow.hotelSupplierForms![
    keys[1]!
  ]!.settings!.supplierFormPrices!.pp!.amount = '999';
  const document = supplierDocumentScope(primary, 'HOTEL');
  expect(
    sharedHotelSupplierScopes(document)[1]!.workflow.supplierFormSettings!
      .supplierFormPrices!.pp!.amount,
  ).toBe('456');
});
