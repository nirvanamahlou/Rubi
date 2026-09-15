import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';

const renderer = vi.hoisted(() =>
  vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 synthetic')),
);
vi.mock('@/modules/reservations/server/ticket-pdf', () => ({
  renderTicketPdf: renderer,
}));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.test/api/v1',
}));
vi.mock('node:fs/promises', () => ({
  readFile: vi.fn().mockResolvedValue(Buffer.from('safe')),
}));

import { GET } from '@/app/reservations/requests/[id]/tickets/pdf/route';
import { ticketPdfHtml } from './ticket-pdf-html';
import { reservationTickets } from '../model/reservation-tickets';

const id = '00000000-0000-4000-8000-000000000001';
const passengerId = '00000000-0000-4000-8000-000000000002';
const cityOne = '00000000-0000-4000-8000-000000000003';
const cityTwo = '00000000-0000-4000-8000-000000000004';
const intake = {
  id,
  contractVersion: 1,
  snapshot: {
    version: 1,
    requestId: id,
    contractId: '00000000-0000-4000-8000-000000000005',
    contractNumber: 'SC-TEST-01',
    contractVersion: 1,
    customerId: passengerId,
    passengerIds: [passengerId],
    selectedTicketOfferIds: ['offer'],
    hotelSelection: null,
    createdAt: '2026-09-12T00:00:00Z',
    serviceSelections: [
      { clientKey: 'flight', kind: 'FLIGHT', titleSnapshot: 'Flight' },
    ],
    passengerAssignments: [
      {
        customerId: passengerId,
        displayNameSnapshot: '<Passenger>',
        ageCategory: 'ADT',
        serviceClientKeys: ['flight'],
      },
    ],
    ticketSelections: [
      {
        serviceClientKey: 'flight',
        direction: 'OUTBOUND',
        offerId: 'offer',
        originId: cityOne,
        destinationId: cityTwo,
        departureAt: '2026-09-19T08:00:00Z',
        arrivalAt: '2026-09-19T10:00:00Z',
        carrierNameSnapshot: 'TEST AIR',
        serviceNumberSnapshot: 'TEST-01',
        cabinClassCode: 'ECONOMY',
      },
    ],
  },
  workflow: {
    version: 1,
    supplierStatus: 'NEW',
    roomOrder: [],
    ageOverrides: {},
    branding: {
      kind: 'OWN',
      companyCode: 'NIYAYESH_SEIR_SAHAR',
      name: 'Niyayesh Seir',
    },
  },
} as unknown as ReservationIntakeV1 & { workflow: TravelWorkflowStateV1 };

const request = (query = '') =>
  new Request(
    `http://localhost/reservations/requests/${id}/tickets/pdf${query}`,
    {
      headers: { cookie: 'test-session' },
    },
  );

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('reservation ticket PDF', () => {
  it('downloads authorized saved ticket data as a private PDF', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: intake }))
      .mockImplementation(() =>
        Promise.resolve(
          Response.json({
            data: { name: 'City', attributes: { englishName: 'CITY' } },
          }),
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(request(`?passengerId=${passengerId}`), {
      params: Promise.resolve({ id }),
    });
    if (!response.ok) throw new Error(await response.text());
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Cache-Control')).toContain('no-store');
    expect(renderer).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      headers: { cookie: 'test-session' },
      redirect: 'error',
    });
  });

  it('uses the passenger passport spelling and the matching airline logo through public APIs', async () => {
    const logoId = '00000000-0000-4000-8000-000000000010';
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith(`/reservations/requests/${id}/workflow`))
        return Promise.resolve(Response.json({ data: intake }));
      if (url.endsWith(`/reservations/requests/${id}/passengers`))
        return Promise.resolve(
          Response.json({
            data: [
              {
                id: passengerId,
                passportFirstName: 'ALI',
                passportLastName: 'HOSSEINI',
                gender: 'M',
              },
            ],
          }),
        );
      if (url.includes('/master-data/airlines?'))
        return Promise.resolve(
          Response.json({
            data: [
              {
                id: logoId,
                resource: 'airlines',
                status: 'active',
                name: 'TEST AIR',
                code: 'TEST',
                attributes: { logoFileReference: logoId },
              },
            ],
            meta: { page: 1, pageSize: 25, total: 1 },
          }),
        );
      if (url.endsWith(`/documents/${logoId}/preview`))
        return Promise.resolve(
          new Response(Buffer.from('safe'), {
            headers: { 'content-type': 'image/png' },
          }),
        );
      return Promise.resolve(
        Response.json({
          data: {
            name: 'City',
            code: 'AYT',
            attributes: { englishName: 'ANTALYA' },
          },
        }),
      );
    });
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    const html = renderer.mock.calls[0]?.[0] as string;
    expect(html).toContain('MR ALI HOSSEINI');
    expect(html).toContain('class="airline-logo"');
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).endsWith(`/documents/${logoId}/preview`),
      ),
    ).toBe(true);
  });

  it('uses the canonical passenger name for a legacy snapshot without a name', async () => {
    const legacy = structuredClone(intake);
    delete legacy.snapshot.passengerAssignments?.[0]?.displayNameSnapshot;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: legacy }))
      .mockResolvedValueOnce(
        Response.json({
          data: [{ id: passengerId, displayName: 'Legacy Passenger' }],
          canEdit: true,
        }),
      )
      .mockImplementation(() =>
        Promise.resolve(
          Response.json({
            data: { name: 'City', attributes: { englishName: 'CITY' } },
          }),
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(request(`?passengerId=${passengerId}`), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(200);
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      `http://api.test/api/v1/reservations/requests/${id}/passengers`,
    );
    expect(renderer.mock.calls[0]?.[0]).toContain('Legacy Passenger');
  });

  it('stops before rendering when workflow access is forbidden', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 403 })),
    );
    const response = await GET(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(403);
    expect(renderer).not.toHaveBeenCalled();
  });

  it('escapes stored fields and emits one A4 page per passenger', () => {
    const tickets = reservationTickets(intake.snapshot);
    const html = ticketPdfHtml(
      tickets,
      { [cityOne]: 'TEHRAN', [cityTwo]: 'ANTALYA' },
      {
        name: 'Niyayesh <Seir>',
        logoDataUrl: 'data:image/png;base64,c2FmZQ==',
      },
    );
    expect(html).toContain('&lt;Passenger&gt;');
    expect(html).toContain('Niyayesh &lt;Seir&gt;');
    expect(html).not.toContain('<Passenger>');
    expect(html).toContain('@page{size:A4 portrait');
    expect(html).toContain('TEST-01');
    expect(html).toContain('ISSUED');
    expect(html).not.toContain('DRAFT');
    expect(html).not.toContain('NOTICE');
  });

  it('renders the selected carrier mark, both routes and age/sex titles without invented baggage', () => {
    const logo = 'data:image/png;base64,c2FmZQ==';
    const tickets = reservationTickets({
      ...intake.snapshot,
      passengerIds: [passengerId, '00000000-0000-4000-8000-000000000006'],
      passengerAssignments: [
        {
          customerId: passengerId,
          displayNameSnapshot: 'ALI',
          ageCategory: 'ADT',
          serviceClientKeys: ['flight'],
        },
        {
          customerId: '00000000-0000-4000-8000-000000000006',
          displayNameSnapshot: 'LILY',
          ageCategory: 'CHD',
          serviceClientKeys: ['flight'],
        },
      ],
    } as ReservationIntakeV1['snapshot']);
    tickets[0]!.gender = 'M';
    const html = ticketPdfHtml(
      tickets,
      {
        [cityOne]: { name: 'TEHRAN', code: 'IKA' },
        [cityTwo]: { name: 'ANTALYA', code: 'AYT' },
      },
      { name: 'Niyayesh', logoDataUrl: logo },
      {
        'TEST AIR': { name: 'Test Air', logoDataUrl: logo },
      },
    );
    expect(html).toContain('MR ALI');
    expect(html).toContain('CHD LILY');
    expect(html).toContain('IKA');
    expect(html).toContain('AYT');
    expect(html).toContain(
      'PRESENCE 03:00 BEFORE FLIGHT TIME AT THE AIRPORT IS MANDATORY',
    );
    expect(html).toContain('حضور در فرودگاه ۳ ساعت قبل از پرواز الزامی است.');
    expect(html).toContain('class="airline-logo"');
    expect(html).not.toContain('>20<');
  });

  it('uses the finance-gated Sales endpoint for a Sales download', async () => {
    const contractId = intake.snapshot.contractId;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: intake }))
      .mockImplementation(() =>
        Promise.resolve(
          Response.json({
            data: { name: 'City', attributes: { englishName: 'CITY' } },
          }),
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(request(`?salesContractId=${contractId}`), {
      params: Promise.resolve({ id }),
    });
    expect(response.status).toBe(200);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      `http://api.test/api/v1/sales/contracts/${contractId}/travel-documents`,
    );
    expect(renderer).toHaveBeenCalledOnce();
  });

  it('does not render Sales tickets when the Finance-gated API rejects access', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status: 403 })),
    );
    const response = await GET(
      request(`?salesContractId=${intake.snapshot.contractId}`),
      { params: Promise.resolve({ id }) },
    );
    expect(response.status).toBe(403);
    expect(renderer).not.toHaveBeenCalled();
  });

  it('returns a clear runtime message when no local PDF browser is available', async () => {
    renderer.mockRejectedValueOnce(new Error('PDF_RUNTIME_UNAVAILABLE'));
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ data: intake }))
      .mockImplementation(() =>
        Promise.resolve(
          Response.json({
            data: { name: 'City', attributes: { englishName: 'CITY' } },
          }),
        ),
      );
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      message: 'مرورگر Chrome یا Edge برای ساخت PDF پیدا نشد.',
    });
  });

  it('rejects unknown passenger and malformed identifiers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ data: intake })),
    );
    const missing = await GET(
      request('?passengerId=00000000-0000-4000-8000-000000000099'),
      { params: Promise.resolve({ id }) },
    );
    expect(missing.status).toBe(409);
    const invalid = await GET(request(), {
      params: Promise.resolve({ id: '../bad' }),
    });
    expect(invalid.status).toBe(400);
  });
});
