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
    expect(html).toContain('ARRIVAL');
    expect(html).toContain('DEPARTURE');
    expect(html).not.toContain('OUTBOUND');
    expect(html).not.toContain('RETURN ONLY');
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

import {
  sharedHotelDrafts,
  saveHotelQuotationSequence,
} from './shared-hotel-supplier-editor';
import { sharedHotelSupplierTables } from './shared-hotel-supplier-tables';
import { ReservationSettingsForm } from '../components/reservation-settings';
import { vi } from 'vitest';
it('uses one shared editor while retaining every hotel date, room and independent purchase quote', () => {
  const { intake, refs } = fixture();
  const primary = intake.workflow.supplierFormSettings!;
  const before = structuredClone(intake);
  const drafts = sharedHotelDrafts(
    intake,
    refs,
    {
      ...primary,
      text: {
        ...primary.text,
        broker: 'UPDATED COMMON',
        remarks: 'ONE NOTICE',
      },
    },
    {},
  );
  expect(drafts).toHaveLength(2);
  expect(drafts[1]!.settings.text.broker).toBe('UPDATED COMMON');
  expect(drafts[1]!.settings.text.remarks).toBe('ONE NOTICE');
  expect(drafts[1]!.settings.text.checkIn).toBe('2026-11-04');
  expect(drafts[1]!.settings.supplierFormPrices!.pp!.amount).toBe('456');
  expect(drafts[1]!.settings.rooms![0]!.roomTypeNameSnapshot).toBe(
    'SECOND SINGLE · Single',
  );
  const html = renderToStaticMarkup(
    <ReservationSettingsForm
      intake={hotelFormScope(intake, drafts[0]!.stay.key)}
      refs={refs}
      sharedSource={intake}
      sharedHotelBroker
      onSaved={() => {}}
      onDirty={() => {}}
    />,
  );
  expect(html.match(/جدول قیمت فرم رزرواسیون/g)).toHaveLength(1);
  expect(html).toContain('SECOND HOTEL');
  expect(html).toContain('SECOND SINGLE');
  expect(intake).toEqual(before);
});
it('consolidates room quotations with their own currencies, factors and nights in both outputs', () => {
  const { intake, refs } = fixture();
  const stays = reservationHotelStays(intake.snapshot);
  stays.forEach((stay, index) => {
    const settings = intake.workflow.hotelSupplierForms![stay.key]!.settings!;
    settings.hotelRoomPrices = {
      currencyCode: index ? 'USD' : 'EUR',
      rooms: [{ roomOrdinal: 1, baseAmount: index ? '40' : '20', factor: '2' }],
    };
  });
  const primary = hotelFormScope(intake, stays[0]!.key);
  const tables = sharedHotelSupplierTables(primary, refs);
  expect(tables).toHaveLength(3);
  expect(tables[2]!.rows).toContainEqual([
    2,
    '1',
    'SECOND SINGLE · Single',
    '40 USD',
    '2',
    '5',
    '400 USD',
  ]);
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
    expect(html.match(/HOTEL INFORMATION/g)).toHaveLength(1);
    expect(html.match(/PURCHASE PRICES/g)).toHaveLength(1);
    expect(html).toContain('400 USD');
    expect(html).toContain('20 EUR');
    expect(html).toContain('SECOND SINGLE');
  }
});
it('chains actual returned workflow versions and stops after a failed hotel save', async () => {
  const state = (version: number) => ({ version }) as never;
  const checkpoint = vi.fn();
  const write = vi
    .fn()
    .mockResolvedValueOnce({ data: state(8) })
    .mockResolvedValueOnce({ data: state(11) });
  expect(
    (
      await saveHotelQuotationSequence(
        ['first', 'second'],
        4,
        write,
        checkpoint,
      )
    ).data,
  ).toEqual({ version: 11 });
  expect(write.mock.calls).toEqual([
    ['first', 4],
    ['second', 8],
  ]);
  const fail = vi
    .fn()
    .mockResolvedValueOnce({ data: state(5) })
    .mockRejectedValueOnce(new Error('VERSION_CHANGED'));
  checkpoint.mockClear();
  await expect(
    saveHotelQuotationSequence(
      ['first', 'second', 'third'],
      4,
      fail,
      checkpoint,
    ),
  ).rejects.toThrow('VERSION_CHANGED');
  expect(fail).toHaveBeenCalledTimes(2);
  expect(checkpoint).toHaveBeenCalledExactlyOnceWith({ version: 5 });
});

it.runIf(process.env.SHARED_SUPPLIER_PDF_SMOKE === '1')(
  'renders the consolidated shared-broker PDF for visual review',
  async () => {
    const { intake, refs } = fixture();
    const { readFile, writeFile, mkdir } = await import('node:fs/promises');
    const { renderReservationPdf } = await import('../server/reservation-pdf');
    const { join } = await import('node:path');
    const css = await readFile(
      join(
        process.cwd(),
        'src/modules/reservations/components/reservation-form-sheet.module.css',
      ),
      'utf8',
    );
    const logo = await readFile(
      join(process.cwd(), 'public/brand/niyayesh.png'),
    );
    const primary = hotelFormScope(
      intake,
      reservationHotelStays(intake.snapshot)[0]!.key,
    );
    const pdf = await renderReservationPdf(
      primary,
      refs,
      'data:image/png;base64,' + logo.toString('base64'),
      css,
      false,
      'https://example.test',
    );
    await mkdir(join(process.cwd(), 'tmp/pdfs'), { recursive: true });
    await writeFile(
      join(process.cwd(), 'tmp/pdfs/shared-broker-reservation.pdf'),
      pdf,
    );
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  },
  180_000,
);
