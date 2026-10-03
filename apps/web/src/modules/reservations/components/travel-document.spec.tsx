import { defaultVoucherSettings } from '../model/voucher-settings';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';
import { TravelDocument } from './travel-document';
import { ReservationSettingsForm } from './reservation-settings';
const intake = {
  snapshot: {
    contractNumber: 'SYNTHETIC',
    passengerIds: [],
    serviceSelections: [],
    hotelSelection: null,
  },
  workflow: {
    version: 1,
    supplierStatus: 'NEW',
    voucherIssued: false,
    roomOrder: [],
    ageOverrides: {},
    branding: {
      kind: 'OWN',
      referenceId: 'company',
      name: 'Synthetic Company',
      logoFileId: null,
      companyCode: 'NIYAYESH_SEIR_SAHAR',
    },
  },
} as unknown as ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 };
describe('travel output branding and readiness', () => {
  it('places one supplier picker before the single reservation preview', () => {
    const html = renderToStaticMarkup(
      <ReservationSettingsForm
        intake={intake}
        refs={{}}
        showDocument
        onDirty={() => {}}
        onSaved={() => {}}
      />,
    );
    expect(html.match(/data-document-preview/g)).toHaveLength(1);
    expect(html.match(/data-reservation-form-page/g)).toHaveLength(1);
    expect(html.indexOf('role="combobox"')).toBeLessThan(
      html.indexOf('data-document-preview'),
    );
    expect(html).not.toMatch(
      /<label[^>]*>[^<]*<span[^>]*>[^<]*<\/span><div[^>]*[^]*?role="combobox"/,
    );
  });
  it('uses the registered own-company code for its real bundled logo', () => {
    const html = renderToStaticMarkup(<TravelDocument intake={intake} />);
    expect(html).toContain('/brand/niyayesh.png');
    expect(html).toContain('SYNTHETIC');
  });
  it('renders an issued hotel voucher with booking reference and stamp in the shared theme', () => {
    const settings = defaultVoucherSettings(intake, {});
    settings.text.broker = 'SYNTHETIC BROKER';
    settings.flags.hotel = true;
    const html = renderToStaticMarkup(
      <TravelDocument
        intake={{
          ...intake,
          workflow: {
            ...intake.workflow,
            voucherIssued: true,
            supplierStatus: 'CONFIRMED',
            supplierReference: 'SUPPLIER-TEST',
            voucherSettings: settings,
          },
        }}
        voucher
      />,
    );
    expect(html).toContain('HOTEL VOUCHER');
    expect(html).toContain('دانلود واچر');
    expect(html).toMatch(/SUPPLIER<\/span><b[^>]*>0<\/b>/);
    expect(html).not.toContain('SYNTHETIC BROKER');
    expect(html).toContain('STAMP');
    expect(html).toContain('ROOM QUANTITIES BY TYPE');
    expect(html).not.toContain('subject to supplier confirmation');
  });
  it('does not render an unissued voucher', () => {
    const html = renderToStaticMarkup(
      <TravelDocument intake={intake} voucher />,
    );
    expect(html).not.toContain('SYNTHETIC');
    expect(html).toContain('disabled');
  });
  it('does not substitute the own logo for an agency with unavailable logo', () => {
    const html = renderToStaticMarkup(
      <TravelDocument
        intake={{
          ...intake,
          workflow: {
            ...intake.workflow,
            branding: {
              kind: 'AGENCY',
              referenceId: 'agency',
              name: 'Synthetic Agency',
              logoFileId: 'unavailable',
            },
          },
        }}
      />,
    );
    expect(html).not.toContain('/brand/niyayesh-seir-full.png');
    expect(html).toContain('disabled');
  });
});

it('applies an unsaved selected broker immediately without adding a manual supplier input', () => {
  const settings = defaultVoucherSettings(intake, {});
  settings.text.broker = 'SELECTED BROKER';
  const html = renderToStaticMarkup(
    <TravelDocument intake={intake} previewSettings={settings} dirty />,
  );
  expect(html).toContain('SELECTED BROKER');
  expect(html).not.toContain('reservation-supplier-name');
  expect(html.match(/data-reservation-form-page/g)).toHaveLength(1);
  expect(html).toContain('Reservation@niyayehseir.com');
});
