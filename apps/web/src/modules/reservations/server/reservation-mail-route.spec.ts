import { createHash, createHmac } from 'node:crypto';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ render: vi.fn(), fetch: vi.fn() }));
vi.mock('./reservation-pdf', () => ({
  renderReservationPdf: mock.render,
  prepareReservationHtml: vi.fn(),
}));
vi.mock('../model/output-references', () => ({
  loadOutputReferences: async () => ({}),
}));
vi.mock('@/modules/travel-documents/server/public-document-store', () => ({
  createPublicDocument: () => undefined,
}));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.test/api/v1',
}));
vi.mock('node:fs/promises', () => ({
  readFile: async () => Buffer.from('synthetic'),
}));
import { POST } from '@/app/reservations/requests/[id]/pdf/route';
import { defaultVoucherSettings } from '../model/voucher-settings';
import type { ReservationFormIntake } from '../model/reservation-form';
const id = '11111111-1111-4111-8111-111111111111';
const secret = 'synthetic-pdf-signing-key-32-bytes';
const bytes = Buffer.from('%PDF-1.4 synthetic NOTICE');
const intake = {
  id,
  receivedAt: '2026-11-08T00:00:00Z',
  snapshot: {
    contractNumber: 'TEST',
    passengerIds: [],
    serviceSelections: [],
    hotelSelection: null,
  },
  workflow: {
    version: 5,
    supplierStatus: 'NEW',
    roomOrder: [],
    ageOverrides: {},
    note: 'INTERNAL',
    branding: {
      kind: 'OWN',
      companyCode: 'NIYAYESH_SEIR_SAHAR',
      name: 'Synthetic',
    },
  },
} as unknown as ReservationFormIntake;
intake.workflow.supplierFormSettings = defaultVoucherSettings(intake, {});
intake.workflow.supplierFormSettings.brokerId = id;
intake.workflow.supplierFormSettings.text.broker = 'Synthetic';
intake.workflow.supplierFormSettings.text.remarks = 'LATEST NOTICE';
intake.workflow.sentSupplierFormSettings = structuredClone(
  intake.workflow.supplierFormSettings,
);
intake.workflow.sentSupplierFormSettings.text.remarks = 'OLD NOTICE';
function request(
  body: unknown = { expectedVersion: 5 },
  origin = 'http://localhost',
) {
  return new Request(`http://localhost/reservations/requests/${id}/pdf`, {
    method: 'POST',
    headers: {
      origin,
      cookie: 'synthetic-session',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('RESERVATION_PDF_MAIL_SECRET', secret);
  vi.stubGlobal('fetch', mock.fetch);
  mock.render.mockResolvedValue(bytes);
  mock.fetch.mockImplementation(async (url: string, options?: RequestInit) =>
    options?.method === 'POST'
      ? Response.json({ data: { version: 6 } })
      : Response.json({ data: structuredClone(intake) }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it('renders the saved current NOTICE and submits only signed PDF bytes, never browser content', async () => {
  const response = await POST(
    request({ expectedVersion: 5, text: 'INJECTED', pdf: 'INJECTED' }),
    { params: Promise.resolve({ id }) },
  );
  expect(response.status).toBe(200);
  expect(
    mock.render.mock.calls[0]![0].workflow.supplierFormSettings.text.remarks,
  ).toBe('LATEST NOTICE');
  const send = mock.fetch.mock.calls.find(
    (call) => call[1]?.method === 'POST',
  )!;
  expect(send[0]).toBe(
    `http://api.test/api/v1/reservations/requests/${id}/supplier-email`,
  );
  const form = send[1].body as FormData;
  expect(Buffer.from(await (form.get('pdf') as Blob).arrayBuffer())).toEqual(
    bytes,
  );
  expect(form.get('text')).toBeNull();
  expect(send[1].headers['x-reservation-pdf-signature']).toBe(
    createHmac('sha256', secret)
      .update(
        JSON.stringify([
          'reservation-pdf-v1',
          id,
          5,
          '',
          createHash('sha256').update(bytes).digest('hex'),
        ]),
      )
      .digest('hex'),
  );
});
it('rejects cross-origin, missing configuration and invalid commands before rendering', async () => {
  expect(
    (
      await POST(request({}, 'https://other.test'), {
        params: Promise.resolve({ id }),
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await POST(request({ expectedVersion: -1 }), {
        params: Promise.resolve({ id }),
      })
    ).status,
  ).toBe(400);
  vi.stubEnv('RESERVATION_PDF_MAIL_SECRET', '');
  expect(
    (await POST(request(), { params: Promise.resolve({ id }) })).status,
  ).toBe(503);
  expect(mock.render).not.toHaveBeenCalled();
});
it('rejects stale data and renderer failure without requesting an email', async () => {
  expect(
    (
      await POST(request({ expectedVersion: 4 }), {
        params: Promise.resolve({ id }),
      })
    ).status,
  ).toBe(409);
  mock.render.mockRejectedValue(new Error('PDF_RUNTIME_UNAVAILABLE'));
  expect(
    (await POST(request(), { params: Promise.resolve({ id }) })).status,
  ).toBe(503);
  expect(mock.fetch.mock.calls.some((call) => call[1]?.method === 'POST')).toBe(
    false,
  );
});
it.each([401, 403, 404])(
  'does not render or submit a PDF when the authenticated API returns %s',
  async (status) => {
    mock.fetch.mockResolvedValue(
      Response.json({ message: 'Unavailable' }, { status }),
    );
    const response = await POST(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(status);
    expect(mock.render).not.toHaveBeenCalled();
    expect(
      mock.fetch.mock.calls.some((call) => call[1]?.method === 'POST'),
    ).toBe(false);
  },
);
it('returns disabled-mail rejection without reporting a queued email', async () => {
  mock.fetch.mockImplementation(async (_url: string, options?: RequestInit) =>
    options?.method === 'POST'
      ? Response.json(
          { message: 'اتصال ایمیل رزرواسیون شرکت هنوز آماده نشده است.' },
          { status: 503 },
        )
      : Response.json({ data: structuredClone(intake) }),
  );
  const response = await POST(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(503);
  expect(await response.text()).toContain(
    'اتصال ایمیل رزرواسیون شرکت هنوز آماده نشده است.',
  );
});
