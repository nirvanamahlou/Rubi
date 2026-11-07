import { beforeEach, describe, expect, it, vi } from 'vitest';
const renderer = vi.hoisted(() =>
  vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 synthetic')),
);
vi.mock('./reservation-pdf', () => ({
  renderReservationPdf: renderer,
  prepareReservationHtml: async (
    output: ReservationFormIntake,
    refs: Parameters<typeof reservationPdfHtml>[1],
    logo: string,
    css: string,
    voucher: boolean,
    origin: string,
    _language: string,
    url: string,
  ) => reservationPdfHtml(output, refs, logo, css, voucher, origin, url),
}));
const publishing = vi.hoisted(() => ({ enabled: false, html: '' }));
vi.mock('@/modules/travel-documents/server/public-document-store', () => ({
  createPublicDocument: () =>
    publishing.enabled
      ? {
          url: 'https://example.test/d/' + 'a'.repeat(32),
          save: async (html: string) => {
            publishing.html = html;
          },
        }
      : undefined,
}));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.test/api/v1',
}));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('safe')),
}));
import { GET } from '@/app/reservations/requests/[id]/pdf/route';
import { reservationPdfHtml } from './reservation-pdf-html';
import {
  defaultVoucherSettings,
  supplierFormData,
} from '../model/voucher-settings';
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
  publishing.enabled = false;
  publishing.html = '';
  vi.unstubAllGlobals();
});
describe('reservation PDF route', () => {
  it('downloads an issued voucher through the contract release gate without reservation permissions', async () => {
    const contractId = '00000000-0000-4000-8000-000000000099';
    const issued = structuredClone(intake);
    issued.snapshot.contractId = contractId;
    issued.workflow.voucherIssued = true;
    issued.workflow.voucherSettings = {
      ...issued.workflow.supplierFormSettings!,
      leaderId: id,
    };
    const fetcher = vi
      .fn()
      .mockImplementation((url: string) =>
        url.endsWith(`/sales/contracts/${contractId}/travel-documents`)
          ? Promise.resolve(
              Response.json({ data: issued, delivery: { approved: true } }),
            )
          : Promise.resolve(new Response('{}', { status: 403 })),
      );
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(
      new Request(
        `http://localhost/reservations/requests/${id}/pdf?kind=voucher&salesContractId=${contractId}`,
      ),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(
      fetcher.mock.calls.some(([url]) => String(url).endsWith('/workflow')),
    ).toBe(false);
    expect(renderer).toHaveBeenCalledOnce();
  });
  it.each([403, 404])(
    'does not bypass the contract release gate after denial (%s)',
    async (status) => {
      const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status }));
      vi.stubGlobal('fetch', fetcher);
      const response = await GET(
        new Request(
          `http://localhost/reservations/requests/${id}/pdf?kind=voucher&salesContractId=${id}`,
        ),
        { params: Promise.resolve({ id }) },
      );
      expect(response.status).toBe(status);
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(renderer).not.toHaveBeenCalled();
    },
  );
  it('rejects a different contract and prevents supplier purchase form downloads from sales', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ data: intake })),
    );
    const result = await GET(
      new Request(
        `http://localhost/reservations/requests/${id}/pdf?kind=voucher&salesContractId=${id}`,
      ),
      { params: Promise.resolve({ id }) },
    );
    expect(result.status).toBe(403);
    const supplier = await GET(
      new Request(
        `http://localhost/reservations/requests/${id}/pdf?salesContractId=${id}`,
      ),
      { params: Promise.resolve({ id }) },
    );
    expect(supplier.status).toBe(400);
    expect(renderer).not.toHaveBeenCalled();
  });
  it('rejects a different reservation request even when its contract ID matches', async () => {
    const unrelated = structuredClone(intake);
    unrelated.id = '00000000-0000-4000-8000-000000000088';
    unrelated.snapshot.contractId = id;
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ data: unrelated }));
    vi.stubGlobal('fetch', fetcher);
    const result = await GET(
      new Request(
        `http://localhost/reservations/requests/${id}/pdf?kind=voucher&salesContractId=${id}`,
      ),
      { params: Promise.resolve({ id }) },
    );
    expect(result.status).toBe(403);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(renderer).not.toHaveBeenCalled();
  });
  it('downloads the sent price snapshot even if an unsent edit has different amounts', async () => {
    const sent = {
      ...intake.workflow.supplierFormSettings!,
      hotelPurchasePrices: [{ amount: '123.50', currencyCode: 'EUR' }],
    };
    const draft = {
      ...sent,
      hotelPurchasePrices: [{ amount: '999', currencyCode: 'USD' }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          data: {
            ...intake,
            workflow: {
              ...intake.workflow,
              supplierFormSettings: draft,
              sentSupplierFormSettings: sent,
            },
          },
        }),
      ),
    );
    const result = await GET(request(), { params: Promise.resolve({ id }) });
    expect(result.status).toBe(200);
    expect(renderer.mock.calls[0]?.[0]).toHaveProperty(
      'workflow.supplierFormSettings.hotelPurchasePrices',
      sent.hotelPurchasePrices,
    );
  });
  it('prints exact independent supplier prices in section06 with a four-field header and NOTICE07, without voucher leakage', () => {
    const settings = {
      ...intake.workflow.supplierFormSettings!,
      hotelPurchasePrices: [
        { amount: '9007199254740993.25', currencyCode: 'EUR' },
        { amount: '100.50', currencyCode: 'USD' },
      ],
      supplierFormPrices: {
        pp: { amount: '9007199254740993.25', currencyCode: 'EUR' },
        ratio: { amount: '100.50', currencyCode: 'USD' },
        transferPp: { amount: '0', currencyCode: 'JPY' },
      },
    };
    const priced = {
      ...intake,
      workflow: {
        ...intake.workflow,
        supplierFormSettings: settings,
        voucherSettings: settings,
      },
    };
    const html = reservationPdfHtml(
      priced,
      {},
      'data:image/png;base64,c2FmZQ==',
      '',
    );
    expect(html).not.toContain('PROPOSED PURCHASE PRICE');
    expect(html).toContain('9,007,199,254,740,993.25 EUR');
    expect(html).toContain('100.50</td>');
    expect(html).not.toContain('100.50 USD');
    expect(html).toContain('Hotel P.P');
    expect(html).toContain('0 JPY');
    expect(html).toContain('<b>06</b><strong>PRICES</strong>');
    expect(html).toContain('<b>07</b><strong>NOTICE</strong>');
    expect(html).toContain('Transfer P.P');
    expect(html).not.toContain('HOTEL TOTAL');
    const voucherHtml = reservationPdfHtml(
      priced,
      {},
      'data:image/png;base64,c2FmZQ==',
      '',
      true,
    );
    expect(voucherHtml).not.toContain('PROPOSED PURCHASE PRICE');
    expect(voucherHtml).not.toContain('9,007,199,254,740,993.25');
    expect(voucherHtml).not.toContain('100.50');
  });
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
    expect(html).not.toContain('BOOKING SUMMARY');
    expect(html).not.toContain('Reservation details');
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
it('downloads an authorized floating voucher without manual broker or leader settings through the Sales finance gate', async () => {
  const value = {
    ...intake,
    snapshot: {
      ...intake.snapshot,
      contractId: '00000000-0000-4000-8000-000000000002',
      serviceSelections: [
        {
          kind: 'HOTEL',
          clientKey: 'hotel',
          metadata: { purchaseSupplyType: 'FLOATING' },
          titleSnapshot: 'SYNTHETIC HOTEL',
        },
      ],
      hotelSelection: {
        hotelNameSnapshot: 'SYNTHETIC HOTEL',
        checkInDate: '2026-11-07',
        checkOutDate: '2026-11-10',
      },
    },
    workflow: {
      ...intake.workflow,
      voucherIssued: true,
      voucherSettings: null,
    },
  };
  const fetcher = vi.fn().mockResolvedValue(Response.json({ data: value }));
  vi.stubGlobal('fetch', fetcher);
  const contractId = '00000000-0000-4000-8000-000000000002';
  const response = await GET(
    new Request(request().url + '?kind=voucher&salesContractId=' + contractId),
    { params: Promise.resolve({ id }) },
  );
  expect(response.status).toBe(200);
  expect(fetcher.mock.calls[0]?.[0]).toContain(
    '/sales/contracts/' + contractId + '/travel-documents',
  );
  expect(renderer).toHaveBeenCalled();
});
it.each([403, 409])(
  'does not render a Sales voucher when server authorization fails with %i',
  async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status })),
    );
    const response = await GET(
      new Request(request().url + '?kind=voucher&salesContractId=' + id),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(status);
    expect(renderer).not.toHaveBeenCalled();
  },
);
it('rejects a different intake returned for the requested Sales voucher', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ data: { ...intake, id: 'another-intake' } }),
      ),
  );
  const response = await GET(
    new Request(request().url + '?kind=voucher&salesContractId=' + id),
    { params: Promise.resolve({ id }) },
  );
  expect(response.status).toBe(403);
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
    'fa',
    undefined,
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
  value.workflow.note = 'SYNTHETIC VOUCHER NOTICE';
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
  expect(html).not.toContain('HOTEL INFORMATION');
  expect(html).toContain('TRANSFER');
  expect(html).toContain('<th>BOARD</th>');
  expect(html).toContain('>BROKER BOARD</td>');
  expect(html).not.toContain('Board:');
  expect(html).toContain('SYNTHETIC VOUCHER NOTICE');
  expect(html).toContain('Reservation@niyayehseir.com');
  expect(html).not.toContain('Country:');
  expect(html).not.toContain('Guide:');
  expect(html).not.toContain('Hotel voucher - present at check-in.');
  expect(html).toContain('SYNTHETIC LEADER / +989000000000');
  expect(html).not.toContain('<th>LEG</th>');
  expect(html).not.toContain(
    '<th>ROOM TYPE</th></tr></thead><tbody><tr><td>01',
  );
  expect(html).not.toContain('<span>TOUR LEADER</span>');
  expect(html).toContain('STAMP');
  expect(html).not.toContain('<img');
});

it('requires a saved recipient before issuing a supplier PDF for a transfer contract', async () => {
  const value = {
    ...intake,
    snapshot: { ...intake.snapshot, serviceSelections: [{ kind: 'TRANSFER' }] },
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
  expect(html).toContain('counter(pages)');
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

it('rejects a transfer contract supplier PDF with a typed name but no directory broker', async () => {
  const settings = { ...intake.workflow.supplierFormSettings! };
  delete settings.brokerId;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      Response.json({
        data: {
          ...intake,
          snapshot: {
            ...intake.snapshot,
            serviceSelections: [{ kind: 'TRANSFER' }],
          },
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
it.each([false, true])(
  'downloads reservation/voucher=%s without a broker or leader for a contract without transfer',
  async (voucher) => {
    const settings = defaultVoucherSettings(intake, {});
    delete settings.brokerId;
    delete settings.leaderId;
    settings.text.broker = '';
    const value = {
      ...intake,
      workflow: {
        ...intake.workflow,
        supplierFormSettings: settings,
        voucherSettings: settings,
        voucherIssued: voucher,
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ data: value })),
    );
    const response = await GET(
      new Request(request().url + (voucher ? '?kind=voucher' : '')),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(200);
    expect(renderer).toHaveBeenCalled();
  },
);

it.each([false, true])(
  'prints the Niyayesh website in the reservation/voucher=%s footer',
  (voucher) => {
    const html = reservationPdfHtml(
      intake,
      {},
      'data:image/png;base64,c2FmZQ==',
      '',
      voucher,
    );
    expect(html).toContain('<span>niyayeshseir.com · 021-72075000</span>');
    expect(html).not.toContain('Nystkt.ir');
  },
);

it.each([false, true])(
  'prints the Jahan reservation/voucher=%s without Niyayesh footer details',
  (voucher) => {
    const companyIntake = structuredClone(intake);
    companyIntake.workflow.branding = {
      kind: 'OWN',
      companyCode: 'JAHAN_BASTAN',
      referenceId: 'company',
      name: 'نیایش سیر سحر',
      logoFileId: null,
    };
    const html = reservationPdfHtml(
      companyIntake,
      {},
      'data:image/png;base64,c2FmZQ==',
      '',
      voucher,
      'https://example.test',
    );
    expect(html).toContain('jahanLogo');
    expect(html).not.toContain('niyayeshseir.com');
    expect(html).not.toContain('niyayehseir.com');
    expect(html).not.toContain('نیایش');
  },
);

it('loads the new Jahan logo for the authorized reservation PDF instead of an old company upload', async () => {
  const companyIntake = structuredClone(intake);
  companyIntake.workflow.branding = {
    kind: 'OWN',
    companyCode: 'JAHAN_BASTAN',
    referenceId: 'company',
    name: 'نیایش سیر سحر',
    logoFileId: 'old-logo',
  };
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ data: companyIntake }));
  vi.stubGlobal('fetch', fetcher);
  const response = await GET(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect(
    fetcher.mock.calls.some(([url]) =>
      String(url).includes('/documents/old-logo'),
    ),
  ).toBe(false);
  expect(renderer.mock.calls[0]?.[2]).toBe('data:image/png;base64,c2FmZQ==');
});

it('publishes only the sent supplier form and keeps public voucher issuance guards', async () => {
  publishing.enabled = true;
  const value = {
    ...intake,
    workflow: {
      ...intake.workflow,
      supplierFormSettings: {
        ...intake.workflow.supplierFormSettings!,
        text: {
          ...intake.workflow.supplierFormSettings!.text,
          broker: 'UNSENT DRAFT',
        },
      },
      sentSupplierFormSettings: {
        ...intake.workflow.supplierFormSettings!,
        text: {
          ...intake.workflow.supplierFormSettings!.text,
          broker: 'SAVED FORM',
        },
      },
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async () => Response.json({ data: value })),
  );
  const response = await GET(new Request(request().url + '?format=share'), {
    params: Promise.resolve({ id }),
  });
  expect(response.status).toBe(200);
  expect(publishing.html).toContain('SAVED FORM');
  expect(publishing.html).toContain('https://example.test/d/' + 'a'.repeat(32));
  expect(publishing.html).not.toContain('UNSENT DRAFT');
  expect(renderer).not.toHaveBeenCalled();
  publishing.html = '';
  const voucher = await GET(
    new Request(request().url + '?kind=voucher&format=share'),
    { params: Promise.resolve({ id }) },
  );
  expect(voucher.status).toBe(409);
  expect(publishing.html).toBe('');
});

it('publishes an issued voucher as its own voucher HTML without a browser PDF process', async () => {
  publishing.enabled = true;
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
    vi.fn().mockImplementation(async () => Response.json({ data: value })),
  );
  const result = await GET(
    new Request(request().url + '?kind=voucher&format=share'),
    { params: Promise.resolve({ id }) },
  );
  expect(result.status).toBe(200);
  expect(publishing.html).toContain('HOTEL VOUCHER');
  expect(publishing.html).toContain('https://example.test/d/' + 'a'.repeat(32));
  expect(renderer).not.toHaveBeenCalled();
});

it('prints supplier service allocations from the contract and reserves a repeating footer', () => {
  const value = structuredClone(intake);
  value.snapshot.passengerIds = ['a', 'b'];
  value.snapshot.passengerAssignments = [
    {
      customerId: 'a',
      displayNameSnapshot: 'ALPHA / ONE',
      ageCategory: 'ADT',
      serviceClientKeys: ['flight-out', 'hotel', 'transfer-back'],
    },
    {
      customerId: 'b',
      displayNameSnapshot: 'BETA / TWO',
      ageCategory: 'ADT',
      serviceClientKeys: ['flight-back', 'insurance'],
    },
  ] as never;
  value.snapshot.serviceSelections = [
    {
      clientKey: 'flight-out',
      kind: 'FLIGHT',
      metadata: { direction: 'OUTBOUND' },
    },
    {
      clientKey: 'flight-back',
      kind: 'FLIGHT',
      metadata: { direction: 'RETURN' },
    },
    { clientKey: 'hotel', kind: 'HOTEL' },
    {
      clientKey: 'transfer-back',
      kind: 'TRANSFER',
      metadata: { direction: 'RETURN' },
    },
    { clientKey: 'insurance', kind: 'INSURANCE' },
  ] as never;
  value.snapshot.hotelSelection = {
    serviceClientKey: 'hotel',
    hotelId: 'hotel',
    hotelNameSnapshot: 'SAMPLE HOTEL',
    checkInDate: '2026-11-01',
    checkOutDate: '2026-11-04',
  } as never;
  value.workflow.supplierFormSettings = defaultVoucherSettings(value, {});
  value.workflow.supplierFormSettings.flags.withLetterhead = false;
  const html = reservationPdfHtml(value, {}, '', '');
  expect(html).toContain('<th>FLIGHT OUT</th>');
  expect(html).toContain('<th>TRF IN</th>');
  expect(html).toContain('<th>TRF OUT</th>');
  expect(html).toContain('FLIGHT INFORMATION');
  expect(html).not.toContain('class="bookingSection"');
  expect(html).toContain('table hotelInformation');
  expect(html).toContain(
    'ALPHA / ONE</td><td dir="auto">Male</td><td dir="auto">ADL</td><td dir="auto">✓</td><td dir="auto">-</td><td dir="auto">01 NOV 2026',
  );
  expect(html).not.toContain('<th>OTHER SERVICES</th>');
  expect(
    supplierFormData(value).passengers.find((p) => p.id === 'b')?.otherServices,
  ).toBe('INSURANCE');
  expect(html).toContain('position:fixed;height:26mm;display:block;bottom:0');
  expect(html).toContain('margin:8.5mm');
  expect(html.match(/<div data-reservation-contact/g)).toHaveLength(1);
  expect(html).not.toMatch(/[\u0600-\u06ff]/);
});

it.each(['?formScope=FOREIGN', '?kind=voucher&formScope=RETURN'])(
  'rejects an invalid or voucher transfer form scope before reading data: %s',
  async (query) => {
    vi.stubGlobal('fetch', vi.fn());
    const response = await GET(new Request(request().url + query), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  },
);

it('publishes logo-free vouchers without fetching issuer logo and preserves normal supplier output and issuance guards', async () => {
  publishing.enabled = true;
  const value = structuredClone(intake);
  value.workflow.branding = {
    ...value.workflow.branding!,
    voucherWithoutLogo: true,
    logoFileId: 'unavailable-logo',
  };
  value.workflow.voucherIssued = true;
  value.workflow.voucherSettings = {
    ...value.workflow.supplierFormSettings!,
    leaderId: id,
  };
  const fetcher = vi.fn(async (url: string) => {
    if (url.includes('/documents/'))
      throw Error('Voucher issuer logo must not be fetched');
    return Response.json({ data: value });
  });
  vi.stubGlobal('fetch', fetcher);
  const response = await GET(
    new Request(request().url + '?kind=voucher&format=share'),
    { params: Promise.resolve({ id }) },
  );
  expect(response.status).toBe(200);
  expect(publishing.html).toContain('HOTEL VOUCHER');
  expect(publishing.html).toContain('<header class="header">');
  expect(publishing.html).not.toMatch(
    /<img[^>]*class="(?:logo|jahanLogo|agencyLogo)"/,
  );
  expect(() => reservationPdfHtml(value, {}, '', '', false)).toThrow(
    'PDF_LOGO_INVALID',
  );
  value.workflow.voucherIssued = false;
  const denied = await GET(
    new Request(request().url + '?kind=voucher&format=share'),
    { params: Promise.resolve({ id }) },
  );
  expect(denied.status).toBe(409);
});
it('loads the original Ghestiroo logo for the authorized reservation PDF instead of an old company upload', async () => {
  const companyIntake = structuredClone(intake);
  companyIntake.workflow.branding = {
    kind: 'OWN',
    companyCode: 'GHESATI_RO',
    referenceId: 'company',
    name: 'قسطی رو',
    logoFileId: 'old-logo',
  };
  const fetcher = vi
    .fn()
    .mockResolvedValue(Response.json({ data: companyIntake }));
  vi.stubGlobal('fetch', fetcher);
  const response = await GET(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect(
    fetcher.mock.calls.some(([url]) =>
      String(url).includes('/documents/old-logo'),
    ),
  ).toBe(false);
  expect(renderer.mock.calls[0]?.[2]).toBe('data:image/png;base64,c2FmZQ==');
});
