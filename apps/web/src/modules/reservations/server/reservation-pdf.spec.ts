import { beforeEach, describe, expect, it, vi } from 'vitest';
const renderer = vi.hoisted(() =>
  vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 synthetic')),
);
vi.mock('./reservation-pdf', () => ({ renderReservationPdf: renderer }));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.test/api/v1',
}));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('safe')),
}));
import { GET } from '@/app/reservations/requests/[id]/pdf/route';
import { reservationPdfHtml } from './reservation-pdf-html';
import { defaultVoucherSettings } from '../model/voucher-settings';
import type { ReservationFormIntake } from '../model/reservation-form';
const id = '00000000-0000-4000-8000-000000000001';
const intake = {
  id,
  receivedAt: '2026-09-10T10:00:00Z',
  snapshot: {
    contractNumber: 'QA',
    passengerIds: [],
    serviceSelections: [],
    hotelSelection: null,
  },
  workflow: {
    version: 1,
    supplierStatus: 'NEW',
    roomOrder: [],
    ageOverrides: {},
    note: '<script>alert(1)</script>',
    branding: { kind: 'OWN', companyCode: 'NIYAYESH_SEIR_SAHAR', name: 'QA' },
  },
} as unknown as ReservationFormIntake;
intake.workflow.supplierFormSettings = defaultVoucherSettings(intake, {});
intake.workflow.supplierFormSettings.text.broker = 'Synthetic Supplier';
intake.workflow.supplierFormSettings.brokerId = id;
const request = () =>
  new Request(`http://localhost/reservations/requests/${id}/pdf`, {
    headers: { cookie: 'test-session' },
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
describe('reservation PDF route', () => {
  it('stops before rendering or references when workflow read is forbidden', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 403 }));
    vi.stubGlobal('fetch', fetcher);
    expect(
      (await GET(request(), { params: Promise.resolve({ id }) })).status,
    ).toBe(403);
    expect(renderer).not.toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('downloads a private PDF from authorized workflow even while finance delivery is locked', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ data: intake, delivery: { approved: false } }),
      );
    vi.stubGlobal('fetch', fetcher);
    const result = await GET(request(), { params: Promise.resolve({ id }) });
    expect(result.status).toBe(200);
    expect(result.headers.get('Content-Type')).toBe('application/pdf');
    expect(result.headers.get('Content-Disposition')).toContain('attachment');
    expect(result.headers.get('Cache-Control')).toContain('no-store');
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: { cookie: 'test-session' },
      redirect: 'error',
    });
  });
  it('rejects missing branding without emitting a PDF', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: {
            ...intake,
            workflow: { ...intake.workflow, branding: null },
          },
        }),
      ),
    );
    expect(
      (await GET(request(), { params: Promise.resolve({ id }) })).status,
    ).toBe(400);
    expect(renderer).not.toHaveBeenCalled();
  });
  it('rejects invalid identifiers before contacting the API', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(
      (await GET(request(), { params: Promise.resolve({ id: '../other' }) }))
        .status,
    ).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('prints the 2-6 and 6-12 hotel child bands selected for the supplier form', () => {
    const childIntake = {
      ...intake,
      snapshot: {
        ...intake.snapshot,
        passengerIds: ['child-younger', 'child-older'],
        passengerAssignments: [
          {
            customerId: 'child-younger',
            displayNameSnapshot: 'YOUNGER CHILD',
            ageCategory: 'CHD',
          },
          {
            customerId: 'child-older',
            displayNameSnapshot: 'OLDER CHILD',
            ageCategory: 'CHD',
          },
        ],
      },
      workflow: {
        ...intake.workflow,
        roomOrder: ['child-younger', 'child-older'],
      },
    } as unknown as ReservationFormIntake;
    const settings = defaultVoucherSettings(childIntake, {});
    settings.passengers[0]!.hotelChildAgeBand = 'CHD_2_TO_6';
    settings.passengers[1]!.hotelChildAgeBand = 'CHD_6_TO_12';
    childIntake.workflow.supplierFormSettings = settings;

    const html = reservationPdfHtml(
      childIntake,
      {},
      'data:image/png;base64,c2FmZQ==',
      '',
    );
    expect(html).toContain('CHD 2-6');
    expect(html).toContain('CHD 6-12');
    expect(html).toContain('CHILDREN 2-6');
    expect(html).toContain('CHILDREN 6-12');
    expect(html).not.toContain('HOTEL CHILD AGE');
    expect(html).toContain('YOUNGER CHILD');
    expect(html).toContain('OLDER CHILD');
  });
  it('escapes saved text and refuses external logos in the isolated HTML', () => {
    const withMarkup = structuredClone(intake);
    withMarkup.workflow.supplierFormSettings!.text.remarks =
      '<script>alert(1)</script>';
    const html = reservationPdfHtml(
      withMarkup,
      {},
      'data:image/png;base64,c2FmZQ==',
      '',
    );
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('size:A4');
    expect(html).toContain('PASSENGERS');
    expect(() =>
      reservationPdfHtml(intake, {}, 'https://example.com/logo', ''),
    ).toThrow();
  });
});

it('rejects unissued direct voucher downloads before rendering', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ data: intake })),
  );
  const response = await GET(new Request(request().url + '?kind=voucher'), {
    params: Promise.resolve({ id }),
  });
  expect(response.status).toBe(409);
  expect(renderer).not.toHaveBeenCalled();
});
it('downloads an issued voucher using saved voucher settings and a voucher filename', async () => {
  const value = {
    ...intake,
    workflow: {
      ...intake.workflow,
      voucherIssued: true,
      voucherSettings: {
        ...intake.workflow.supplierFormSettings!,
        leaderId: id,
      },
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ data: value })),
  );
  const response = await GET(new Request(request().url + '?kind=voucher'), {
    params: Promise.resolve({ id }),
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('Content-Disposition')).toContain(
    'hotel-voucher-QA.pdf',
  );
  expect(renderer).toHaveBeenCalledWith(
    value,
    {},
    expect.stringContaining('data:image/png;base64,'),
    expect.anything(),
    true,
    'http://localhost',
  );
});
it('renders voucher booking references and a separated summary without letterhead', () => {
  const value = {
    ...intake,
    workflow: {
      ...intake.workflow,
      voucherIssued: true,
      supplierReference: 'VOUCHER-REF',
    },
  };
  value.workflow.voucherSettings = defaultVoucherSettings(value, {});
  value.workflow.voucherSettings.flags.withLetterhead = false;
  value.workflow.voucherSettings.text.broker = 'SYNTHETIC BROKER';
  value.workflow.voucherSettings.text.transferBoard = 'BROKER BOARD';
  value.workflow.voucherSettings.text.leaderName = 'SYNTHETIC LEADER';
  value.workflow.voucherSettings.text.leaderPhone = '+989000000000';
  value.workflow.voucherSettings.flags.tourLeader = true;
  const html = reservationPdfHtml(value, {}, '', '', true);
  expect(html).toContain('HOTEL VOUCHER');
  expect(html).toMatch(/SUPPLIER<\/span><b dir="auto">0<\/b>/);
  expect(html).not.toContain('SYNTHETIC BROKER');
  expect(html).toContain('<section class="bookingSection">');
  expect(html).toContain('ROOM TYPE');
  expect(html).toContain('Board: BROKER BOARD');
  expect(html).toContain('SYNTHETIC LEADER / +989000000000');
  expect(html).not.toContain('<th>LEG</th>');
  expect(html).not.toContain(
    '<th>ROOM TYPE</th></tr></thead><tbody><tr><td>01',
  );
  expect(html).not.toContain('<span>TOUR LEADER</span>');
  expect(html).toContain('STAMP');
  expect(html).not.toContain('<img');
});

it('requires a saved recipient before issuing the supplier reservation PDF', async () => {
  const value = {
    ...intake,
    workflow: { ...intake.workflow, supplierFormSettings: undefined },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(Response.json({ data: value })),
  );
  const response = await GET(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(409);
  expect(renderer).not.toHaveBeenCalled();
});

it('keeps six regular passengers on one supplier form page', () => {
  const ids = Array.from({ length: 6 }, (_, index) => `passenger-${index + 1}`);
  const value = {
    ...intake,
    snapshot: {
      ...intake.snapshot,
      passengerIds: ids,
      passengerAssignments: ids.map((customerId, index) => ({
        customerId,
        displayNameSnapshot: `SYNTHETIC PASSENGER ${index + 1}`,
        ageCategory: 'ADL',
      })),
    },
    workflow: {
      ...intake.workflow,
      roomOrder: ids,
      supplierFormSettings: undefined,
    },
  } as unknown as ReservationFormIntake;
  value.workflow.supplierFormSettings = defaultVoucherSettings(value, {});
  value.workflow.supplierFormSettings.text.broker = 'Synthetic Supplier';
  const html = reservationPdfHtml(
    value,
    {},
    'data:image/png;base64,c2FmZQ==',
    '',
  );
  expect(html.match(/<article class="page"/g)).toHaveLength(1);
  expect(html).toContain('06</td>');
  expect(html).toContain('1 / 1');
  expect(html).not.toContain('<th>LEG</th>');
  expect(html).not.toContain('<span>TOUR LEADER</span>');
});

it('includes contact and a URL QR without repeating complete forms for many passengers', () => {
  const people = Array.from({ length: 14 }, (_, i) => ({
    customerId: 'qa' + i,
    displayNameSnapshot: 'SYNTHETIC ' + i,
    ageCategory: 'ADT',
  }));
  const value = {
    ...intake,
    snapshot: {
      ...intake.snapshot,
      passengerIds: people.map((p) => p.customerId),
      passengerAssignments: people,
    },
    workflow: {
      ...intake.workflow,
      roomOrder: people.map((p) => p.customerId),
    },
  } as unknown as ReservationFormIntake;
  value.workflow.supplierFormSettings = defaultVoucherSettings(value, {});
  const html = reservationPdfHtml(
    value,
    {},
    'data:image/png;base64,c2FmZQ==',
    '',
    false,
    'https://niyayehseir.com',
  );
  expect(html.match(/<article /g)).toHaveLength(1);
  expect(html).toContain('Reservation@niyayehseir.com');
  expect(html).toContain('https://niyayehseir.com/r/' + id);
  expect(html).toContain('aria-label="Reservation form QR"');
  expect(html).toContain('SYNTHETIC 13');
});

it('keeps six selected passengers on one compact hotel voucher page', () => {
  const ids = Array.from(
    { length: 6 },
    (_, index) => `voucher-passenger-${index + 1}`,
  );
  const value = {
    ...intake,
    snapshot: {
      ...intake.snapshot,
      passengerIds: ids,
      passengerAssignments: ids.map((customerId) => ({
        customerId,
        displayNameSnapshot: customerId.toUpperCase(),
        ageCategory: 'ADL',
      })),
    },
    workflow: {
      ...intake.workflow,
      roomOrder: ids,
      voucherSettings: undefined,
    },
  } as unknown as ReservationFormIntake;
  value.workflow.voucherSettings = defaultVoucherSettings(value, {});
  value.workflow.voucherSettings.text.broker = 'SYNTHETIC BROKER';
  const html = reservationPdfHtml(
    value,
    {},
    'data:image/png;base64,c2FmZQ==',
    '',
    true,
  );
  expect(html.match(/<article class="page"/g)).toHaveLength(1);
  expect(html).toContain('VOUCHER-PASSENGER-6');
  expect(html).toContain('1 / 1');
});

it('rejects supplier PDF with a typed name but no directory broker', async () => {
  const settings = { ...intake.workflow.supplierFormSettings! };
  delete settings.brokerId;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        data: {
          ...intake,
          workflow: { ...intake.workflow, supplierFormSettings: settings },
        },
      }),
    ),
  );
  expect(
    (await GET(request(), { params: Promise.resolve({ id }) })).status,
  ).toBe(409);
  expect(renderer).not.toHaveBeenCalled();
});
