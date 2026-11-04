import { expect, it } from 'vitest';
import {
  defaultSupplierFormSettings,
  supplierFormData,
} from './voucher-settings';
import {
  supplierDocumentKinds,
  supplierDocumentScope,
} from './supplier-document-scope';
import { supplierPriceTableData } from './supplier-form-prices';
import { reservationPdfHtml } from '../server/reservation-pdf-html';
import type { ReservationFormIntake } from './reservation-form';
function fixture() {
  const intake = {
    receivedAt: '2026-10-31T00:00:00Z',
    snapshot: {
      contractNumber: 'SYNTHETIC',
      passengerIds: ['a', 'b'],
      passengerAssignments: [
        {
          customerId: 'a',
          displayNameSnapshot: 'ALPHA / TEST',
          ageCategory: 'ADT',
          serviceClientKeys: ['h', 'out', 'back'],
        },
        {
          customerId: 'b',
          displayNameSnapshot: 'BETA / TEST',
          ageCategory: 'ADT',
          serviceClientKeys: ['h', 'out'],
        },
      ],
      serviceSelections: [
        { clientKey: 'h', kind: 'HOTEL' },
        {
          clientKey: 'out',
          kind: 'TRANSFER',
          metadata: { direction: 'OUTBOUND' },
        },
        {
          clientKey: 'back',
          kind: 'TRANSFER',
          metadata: { direction: 'RETURN' },
        },
      ],
      hotelSelection: {
        serviceClientKey: 'h',
        hotelId: 'hotel',
        hotelNameSnapshot: 'HOTEL ONLY',
        checkInDate: '2026-11-01',
        checkOutDate: '2026-11-04',
        rooms: [
          { ordinal: 1, adults: 2, childAges: [], roomTypeNameSnapshot: 'DBL' },
        ],
      },
    },
    workflow: { version: 1, roomOrder: [], ageOverrides: {}, note: '' },
  } as unknown as ReservationFormIntake;
  const settings = defaultSupplierFormSettings(intake);
  Object.assign(settings, {
    brokerId: '11111111-1111-4111-8111-111111111111',
    transferBrokerId: '22222222-2222-4222-8222-222222222222',
    transferBrokerName: 'OUT SUPPLIER',
    hotelTransferSeparate: true,
    hotelTransferSplit: true,
    hotelTransferReturn: {
      amount: '20',
      currencyCode: 'USD',
      brokerId: '33333333-3333-4333-8333-333333333333',
      brokerName: 'RETURN SUPPLIER',
    },
    hotelTransferCounts: { outbound: 2, returning: 1 },
    hotelRoomPrices: {
      currencyCode: 'EUR',
      rooms: [{ roomOrdinal: 1, baseAmount: '100', factor: '2' }],
    },
    supplierFormPrices: { transferPp: { amount: '10', currencyCode: 'EUR' } },
  });
  settings.text.broker = 'HOTEL SUPPLIER';
  intake.workflow.supplierFormSettings = settings;
  return intake;
}
it('prints separate hotel, outbound and return forms with only their own supplier, prices and allocated passengers', () => {
  const intake = fixture();
  const original = structuredClone(intake);
  expect(supplierDocumentKinds(intake.workflow.supplierFormSettings)).toEqual([
    'HOTEL',
    'OUTBOUND',
    'RETURN',
  ]);
  const hotel = supplierDocumentScope(intake, 'HOTEL');
  const out = supplierDocumentScope(intake, 'OUTBOUND');
  const back = supplierDocumentScope(intake, 'RETURN');
  expect(supplierPriceTableData(hotel).rows).toHaveLength(1);
  expect(supplierPriceTableData(out).rows).toEqual([['10 EUR', '2', '20 EUR']]);
  expect(supplierPriceTableData(back).rows).toEqual([
    ['20 USD', '1', '20 USD'],
  ]);
  expect(supplierFormData(out).passengers).toHaveLength(2);
  expect(supplierFormData(back).passengers.map((p) => p.id)).toEqual(['a']);
  for (const [source, own, excluded] of [
    [hotel, 'HOTEL SUPPLIER', ['OUT SUPPLIER', 'RETURN SUPPLIER']],
    [
      out,
      'OUT SUPPLIER',
      ['HOTEL SUPPLIER', 'RETURN SUPPLIER', 'HOTEL INFORMATION', '600 EUR'],
    ],
    [
      back,
      'RETURN SUPPLIER',
      ['HOTEL SUPPLIER', 'OUT SUPPLIER', 'BETA / TEST'],
    ],
  ] as const) {
    const html = reservationPdfHtml(
      source,
      {},
      'data:image/png;base64,AA==',
      '',
    );
    expect(html).toContain(own);
    for (const value of excluded) expect(html).not.toContain(value);
  }
  expect(intake).toEqual(original);
});
it('retains old combined output when omitted or disabled and supports separate round-trip output', () => {
  const intake = fixture();
  const settings = intake.workflow.supplierFormSettings!;
  settings.hotelTransferSplit = false;
  expect(supplierDocumentKinds(settings)).toEqual(['HOTEL', 'TRANSFER']);
  expect(
    supplierPriceTableData(supplierDocumentScope(intake, 'TRANSFER')).rows,
  ).toEqual([['10 EUR', '3', '30 EUR']]);
  settings.hotelTransferSeparate = false;
  expect(supplierDocumentKinds(settings)).toEqual(['HOTEL']);
  expect(() => supplierDocumentScope(intake, 'TRANSFER')).toThrow();
});
it('derives old optional service flags from canonical allocations without changing the snapshot', () => {
  const intake = fixture();
  for (const p of intake.workflow.supplierFormSettings!.passengers)
    delete p.services;
  expect(
    supplierFormData(supplierDocumentScope(intake, 'RETURN')).passengers.map(
      (p) => p.id,
    ),
  ).toEqual(['a']);
});
