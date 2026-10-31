import type * as PublicDocumentModule from '@/modules/travel-documents/public/use-public-document-link';
const qrState = vi.hoisted(() => ({
  current: {
    status: 'ready',
    url: 'https://example.test/d/' + 'a'.repeat(32),
    html: '',
  } as { status: string; url: string; html: string } | undefined,
}));
vi.mock(
  '@/modules/travel-documents/public/use-public-document-link',
  async (importOriginal) => ({
    ...(await importOriginal<typeof PublicDocumentModule>()),
    usePublicDocumentLink: () => qrState.current,
  }),
);
beforeEach(() => {
  qrState.current = {
    status: 'ready',
    url: 'https://example.test/d/' + 'a'.repeat(32),
    html: '',
  };
});
import { defaultVoucherSettings } from '../model/voucher-settings';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
const supplier = defaultVoucherSettings(intake, {});
supplier.brokerId = 'broker';
supplier.text.broker = 'BROKER';
intake.workflow.supplierFormSettings = supplier;

describe('travel output branding and readiness', () => {
  it('preserves supplier price columns while hiding legacy totals and keeping customer vouchers price-free', () => {
    const settings = {
      ...supplier,
      hotelPurchasePrices: [{ amount: '123.50', currencyCode: 'EUR' }],
      supplierFormPrices: { pp: { amount: '45.25', currencyCode: 'EUR' } },
    };
    const priced = {
      ...intake,
      workflow: {
        ...intake.workflow,
        supplierFormSettings: settings,
        voucherSettings: settings,
      },
    };
    expect(
      defaultVoucherSettings(
        {
          ...priced,
          workflow: { ...priced.workflow, voucherSettings: settings },
        },
        {},
      ).hotelPurchasePrices,
    ).toEqual(settings.hotelPurchasePrices);
    expect(renderToStaticMarkup(<TravelDocument intake={priced} />)).toContain(
      '45.25 EUR',
    );
    expect(
      renderToStaticMarkup(<TravelDocument intake={priced} />),
    ).not.toContain('123.50');
    expect(
      renderToStaticMarkup(<TravelDocument intake={priced} voucher />),
    ).not.toContain('123.50 €');
    expect(
      renderToStaticMarkup(<TravelDocument intake={priced} voucher />),
    ).not.toContain('45.25');
  });
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
    expect(html).not.toContain('BOOKING SUMMARY');
    expect(html).not.toContain('Reservation details');
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
    settings.brokerId = 'broker';
    settings.leaderId = 'leader';
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
    expect(html).not.toContain('DBL · DOUBLE');
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
  settings.brokerId = 'broker';
  const html = renderToStaticMarkup(
    <TravelDocument intake={intake} previewSettings={settings} dirty />,
  );
  expect(html).toContain('SELECTED BROKER');
  expect(html).not.toContain('reservation-supplier-name');
  expect(html.match(/data-reservation-form-page/g)).toHaveLength(1);
  expect(html).toContain('Reservation@niyayehseir.com');
});

it('hides the reservation preview without a selected broker', () => {
  const workflow = { ...intake.workflow };
  delete workflow.supplierFormSettings;
  const html = renderToStaticMarkup(
    <TravelDocument intake={{ ...intake, workflow }} />,
  );
  expect(html).not.toContain('data-document-preview');
  expect(html).toContain('disabled');
});
it('hides an issued voucher without a selected directory leader', () => {
  const settings = defaultVoucherSettings(intake, {});
  settings.brokerId = 'broker';
  const html = renderToStaticMarkup(
    <TravelDocument
      intake={{
        ...intake,
        workflow: {
          ...intake.workflow,
          voucherIssued: true,
          voucherSettings: settings,
        },
      }}
      voucher
    />,
  );
  expect(html).not.toContain('data-document-preview');
});

it.each([false, true])(
  'uses the supplied transparent Jahan logo for reservation/voucher=%s even with an old uploaded logo',
  (voucher) => {
    const companyIntake = structuredClone(intake);
    companyIntake.workflow.branding = {
      kind: 'OWN',
      companyCode: 'JAHAN_BASTAN',
      referenceId: 'company',
      name: 'نیایش سیر سحر',
      logoFileId: 'old-logo',
    };
    companyIntake.workflow.voucherIssued = true;
    const settings = defaultVoucherSettings(companyIntake, {});
    settings.brokerId = 'broker';
    settings.leaderId = 'leader';
    settings.text.broker = 'BROKER';
    companyIntake.workflow.voucherSettings = settings;
    const html = renderToStaticMarkup(
      <TravelDocument intake={companyIntake} voucher={voucher} />,
    );
    expect(html).toContain('/brand/jahan-bastan-transparent.png');
    expect(html).toContain('jahanLogo');
    expect(html).toContain('Jahan Bastan');
    expect(html).not.toContain('نیایش');
    expect(html).not.toContain('niyayehseir.com');
  },
);

it('keeps direct download available on an issued reservation form', () => {
  const issued = {
    ...intake,
    workflow: {
      ...intake.workflow,
      supplierStatus: 'REQUESTED' as const,
      sentSupplierFormSettings: supplier,
      supplierFormSettings: supplier,
    },
  };
  const html = renderToStaticMarkup(<TravelDocument intake={issued} />);
  expect(html).toContain('دانلود مستقیم PDF فرم رزرواسیون');
  expect(html).not.toContain('چاپ / ذخیره PDF');
  expect(html).not.toContain('Save as PDF');
  expect(html).not.toContain('Special room:');
  expect(html).not.toContain('Country:');
  expect(html).not.toContain('subject to supplier confirmation');
});

it('waits for the canonical QR before making the saved form printable', () => {
  qrState.current = undefined;
  const html = renderToStaticMarkup(<TravelDocument intake={intake} />);
  expect(html).toContain('در حال آماده‌سازی بارکد مدرک…');
  expect(html).not.toContain('data-document-preview');
});
it('never prints a pending QR after publication fails', () => {
  qrState.current = { status: 'failed', url: '', html: '' };
  const html = renderToStaticMarkup(<TravelDocument intake={intake} />);
  expect(html).toContain('آماده‌سازی بارکد انجام نشد');
  expect(html).not.toContain('data-document-preview');
});
it('uses the ready document capability in the printed form', () => {
  const html = renderToStaticMarkup(<TravelDocument intake={intake} />);
  expect(html).toContain(qrState.current!.url);
  expect(html).toContain('data-document-preview');
});
it('preserves offline legacy preview only when hosting is explicitly disabled', () => {
  qrState.current = { status: 'disabled', url: '', html: '' };
  expect(renderToStaticMarkup(<TravelDocument intake={intake} />)).toContain(
    'data-document-preview',
  );
});
