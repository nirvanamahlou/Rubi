import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@rubi/contracts';

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
