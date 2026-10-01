import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ReservationFormIntake } from '../model/reservation-form';
import {
  documentSetupSettings,
  ReservationDocumentSetup,
} from './reservation-document-setup';
import { defaultVoucherSettings } from '../model/voucher-settings';
const intake = {
  id: 'request',
  snapshot: {
    contractNumber: 'SYNTHETIC',
    passengerIds: ['p'],
    passengerAssignments: [
      {
        customerId: 'p',
        displayNameSnapshot: 'Synthetic passenger',
        ageCategory: 'ADT',
      },
    ],
    serviceSelections: [],
    ticketSelections: [],
    hotelSelection: null,
  },
  workflow: {
    roomOrder: [],
    ageOverrides: {},
    note: '',
    supplierStatus: 'NEW',
  },
} as unknown as ReservationFormIntake;
describe('reservation document selection stages', () => {
  it('presents searchable broker and independent service checkboxes before generation', () => {
    const html = renderToStaticMarkup(
      <ReservationDocumentSetup
        intake={intake}
        onDirty={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(html).toContain('کارگزار فرم رزرواسیون');
    expect(html).toContain('role="combobox"');
    for (const value of [
      'هتل',
      'ترانسفر',
      'راهنما',
      'تأیید و آماده‌سازی فرم رزرواسیون',
    ])
      expect(html).toContain(value);
    expect(html.match(/type="checkbox"/g)).toHaveLength(4);
  });
  it('keeps saved broker and guide identifiers when opening voucher selection, using sent snapshot', () => {
    const source = structuredClone(intake);
    const sent = defaultVoucherSettings(source, {});
    sent.references = { brokerId: 'broker' };
    sent.text.broker = 'SENT BROKER';
    sent.flags.tourLeader = true;
    source.workflow.sentSupplierFormSettings = sent;
    const result = documentSetupSettings(source, {}, true);
    expect(result.references?.brokerId).toBe('broker');
    expect(result.text.broker).toBe('SENT BROKER');
    expect(source.workflow.voucherSettings).toBeUndefined();
    const html = renderToStaticMarkup(
      <ReservationDocumentSetup
        intake={source}
        voucher
        onDirty={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(html).toContain('تورلیدر همین کارگزار');
    expect(html).toContain('SENT BROKER');
    expect(html).toContain('اطلاعات پایه');
  });
});
