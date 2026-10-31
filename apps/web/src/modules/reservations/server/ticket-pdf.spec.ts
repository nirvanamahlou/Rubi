import { beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  ReservationIntakeV1,
  TravelWorkflowStateV1,
} from '@nora/contracts';

const renderer = vi.hoisted(() =>
  vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 synthetic')),
);
const brandAssetReader = vi.hoisted(() =>
  vi.fn().mockResolvedValue(Buffer.from('safe')),
);
vi.mock('@/modules/reservations/server/ticket-pdf', () => ({
  renderTicketPdf: renderer,
  prepareTicketHtml: async (html: string) => html,
}));
vi.mock('@/modules/reservations/server/ticket-pdf-assets', () => ({
  readTicketBrandAsset: brandAssetReader,
}));
vi.mock('@/lib/environment', () => ({
  getPublicApiBaseUrl: () => 'http://api.test/api/v1',
}));
const publishing = vi.hoisted(() => ({
  enabled: false,
  documents: [] as Array<{ url: string; html: string }>,
}));
vi.mock('@/modules/travel-documents/server/public-document-store', () => ({
  createPublicDocument: () => {
    if (!publishing.enabled) return undefined;
    const url =
      'https://example.test/d/' +
      String(publishing.documents.length).padStart(32, 'a');
    const entry = { url, html: '' };
    publishing.documents.push(entry);
    return {
      url,
      save: async (html: string) => {
        entry.html = html;
      },
    };
  },
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
  publishing.enabled = false;
  publishing.documents.length = 0;
  vi.unstubAllGlobals();
});

describe('reservation ticket PDF', () => {
  it.each([false, true])(
    'downloads current flight facts for an already issued ticket (Sales=%s)',
    async (sales) => {
      const saved = structuredClone(intake);
      Object.assign(saved.snapshot.ticketSelections![0]!, {
        carrierNameSnapshot: 'UPDATED AIR',
        serviceNumberSnapshot: 'UPDATED-9726',
        departureAt: '2026-11-12T21:00:00Z',
        arrivalAt: '2026-11-13T01:00:00Z',
      });
      saved.ticketDocuments = [
        {
          customerId: passengerId,
          number: 'ISSUED-UNCHANGED',
          issuedAt: '2026-09-12T00:00:00Z',
          source: 'AUTO',
        },
      ] as never;
      const fetcher = vi.fn(async (url: string) => {
        if (url.endsWith('/workflow') || url.endsWith('/travel-documents'))
          return Response.json({ data: saved });
        if (url.endsWith('/document-details'))
          return Response.json({
            data: {
              id: 'offer',
              originId: cityOne,
              destinationId: cityTwo,
              economyBaggageKg: '35',
              businessBaggageKg: '45',
            },
          });
        if (
          url.endsWith('/passengers') ||
          url.includes('/master-data/airlines?')
        )
          return Response.json({ data: [] });
        return Response.json({
          data: { name: 'City', attributes: { englishName: 'CITY' } },
        });
      });
      vi.stubGlobal('fetch', fetcher);
      const query = sales
        ? `?salesContractId=${saved.snapshot.contractId}`
        : '';
      expect(
        (await GET(request(query), { params: Promise.resolve({ id }) })).status,
      ).toBe(200);
      const html = renderer.mock.calls[0]?.[0] as string;
      expect(html).toContain('UPDATED AIR');
      expect(html).toContain('UPDATED-9726');
      expect(html).toContain('35 KG');
      expect(html).toContain('ISSUED-UNCHANGED');
      expect(html).not.toContain('TEST-01</span>');
      expect(fetcher.mock.calls[0]?.[0]).toContain(
        sales ? '/travel-documents' : '/workflow',
      );
      expect(intake.snapshot.ticketSelections?.[0]?.serviceNumberSnapshot).toBe(
        'TEST-01',
      );
    },
  );
  it('loads persisted output flight-number overrides into the downloaded PDF', async () => {
    const saved = structuredClone(intake);
    saved.workflow.ticketFlightNumbers = { 'flight-offer': 'B9 4599' };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        Response.json({
          data: url.endsWith('/workflow')
            ? saved
            : url.includes('/master-data/airlines?')
              ? []
              : url.endsWith('/passengers')
                ? []
                : {
                    name: 'Synthetic City',
                    attributes: { englishName: 'CITY' },
                  },
        }),
      ),
    );
    expect(
      (await GET(request(), { params: Promise.resolve({ id }) })).status,
    ).toBe(200);
    const html = renderer.mock.calls[0]?.[0] as string;
    expect(html).toContain('B9 4599');
    expect(html).not.toContain('<span>TEST-01</span>');
    expect(intake.snapshot.ticketSelections?.[0]?.serviceNumberSnapshot).toBe(
      'TEST-01',
    );
  });
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

  it('prints the persisted six-digit number and original issue date with the English itinerary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          Response.json({
            data: url.endsWith('/workflow')
              ? {
                  ...intake,
                  ticketDocuments: [
                    {
                      customerId: passengerId,
                      number: '100123',
                      source: 'AUTO',
                      issuedAt: '2026-10-01T08:00:00Z',
                    },
                  ],
                }
              : {
                  name: url.includes(cityOne) ? 'TEHRAN' : 'ANTALYA',
                  attributes: {},
                },
          }),
        ),
      ),
    );
    const response = await GET(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    const html = renderer.mock.calls[0]![0] as string;
    expect(html).toContain('100123');
    expect(html).toContain('01 OCT 2026');
    expect(html).toContain('TEHRAN → ANTALYA');
    expect(html).toContain('TEST AIR');
  });

  it('still renders when optional city metadata is unavailable', async () => {
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith(`/reservations/requests/${id}/workflow`))
        return Promise.resolve(Response.json({ data: intake }));
      if (url.includes('/master-data/cities/'))
        return Promise.reject(new Error('city service unavailable'));
      if (url.includes('/master-data/airlines?'))
        return Promise.resolve(
          Response.json({
            data: [],
            meta: { page: 1, pageSize: 25, total: 0 },
          }),
        );
      return Promise.resolve(new Response('{}', { status: 404 }));
    });
    vi.stubGlobal('fetch', fetcher);

    const response = await GET(request(), { params: Promise.resolve({ id }) });

    expect(response.status).toBe(200);
    expect(renderer).toHaveBeenCalledOnce();
    expect(renderer.mock.calls[0]?.[0]).toContain('—');
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

  it('uses an uploaded airline logo when the contract spelling differs from the directory name', async () => {
    const logoId = '00000000-0000-4000-8000-000000000010';
    const variant = structuredClone(intake);
    const firstTicket = variant.snapshot.ticketSelections?.[0];
    if (!firstTicket) throw new Error('Missing fixture flight');
    firstTicket.carrierNameSnapshot = 'IRAN AIR TOUR';
    const fetcher = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/workflow'))
        return Promise.resolve(Response.json({ data: variant }));
      if (url.includes('/master-data/airlines?')) {
        const fallback = !new URL(url).searchParams.has('search');
        return Promise.resolve(
          Response.json({
            data: fallback
              ? [
                  {
                    id: logoId,
                    resource: 'airlines',
                    status: 'active',
                    name: 'ایران ایرتور',
                    code: 'B9',
                    attributes: {
                      englishName: 'Iran Airtour',
                      logoFileReference: logoId,
                    },
                  },
                ]
              : [],
            meta: { page: 1, pageSize: 100, total: fallback ? 1 : 0 },
          }),
        );
      }
      if (url.endsWith('/documents/' + logoId + '/preview'))
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
            attributes: { englishName: 'CITY' },
          },
        }),
      );
    });
    vi.stubGlobal('fetch', fetcher);
    const response = await GET(request(), { params: Promise.resolve({ id }) });
    expect(response.status).toBe(200);
    const html = renderer.mock.calls[0]?.[0] as string;
    expect(html).toContain('class="airline-logo"');
    expect(html).toContain('class="logos niyayesh-logos"');
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes('pageSize=100')),
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
    expect(html).toContain('aria-label="Booking reference QR"');
    expect(html).toContain('<figcaption>SC-TEST-01</figcaption>');
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
    for (const ticket of tickets)
      ticket.offers = ticket.offers.map((offer) => ({
        ...offer,
        originAirport: {
          code: 'IKA',
          name: 'Imam Khomeini International Airport',
        },
        destinationAirport: { code: 'AYT', name: 'Antalya Airport' },
      }));
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
    expect(html).toContain('حضور در فرودگاه 3 ساعت قبل از پرواز الزامی است.');
    expect(html).toContain('class="airline-logo"');
    expect(html).not.toContain('>20<');
  });

  it('renders legacy tickets without airport data or a resave and leaves airport fields blank', () => {
    const tickets = reservationTickets(intake.snapshot);
    expect(tickets.length).toBeGreaterThan(0);
    const html = ticketPdfHtml(
      tickets,
      {
        [cityOne]: { name: 'TEHRAN', code: 'IKA' },
        [cityTwo]: { name: 'ANTALYA', code: 'AYT' },
      },
      { name: 'Niyayesh', logoDataUrl: 'data:image/png;base64,c2FmZQ==' },
    );
    expect(html).toContain('TEHRAN');
    expect(html).toContain('ANTALYA');
    expect(html).toContain('class="airport-code"></strong>');
    expect(html).toContain('class="airport-name" dir="auto"></span>');
    expect(html).not.toContain('class="airport-code">IKA');
    expect(html).not.toContain('class="airport-code">AYT');
    expect(html).not.toContain('class="airport-name" dir="auto">—');
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

it('downloads Jahan tickets with the new bundled logo instead of a stale uploaded company logo', async () => {
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
    .mockResolvedValueOnce(Response.json({ data: companyIntake }))
    .mockImplementation(() =>
      Promise.resolve(
        Response.json({
          data: { name: 'City', attributes: { englishName: 'CITY' } },
        }),
      ),
    );
  vi.stubGlobal('fetch', fetcher);
  const response = await GET(request('?passengerId=' + passengerId), {
    params: Promise.resolve({ id }),
  });
  expect(response.status).toBe(200);
  expect(brandAssetReader).toHaveBeenCalledWith('jahan-bastan-transparent.png');
  expect(
    fetcher.mock.calls.some(([url]) =>
      String(url).includes('/documents/old-logo'),
    ),
  ).toBe(false);
  expect(renderer.mock.calls[0]?.[0]).toContain('جهان باستان');
  expect(renderer.mock.calls[0]?.[0]).not.toContain('نیایش');
});

it('publishes separate single-passenger snapshots when exporting all issued tickets', async () => {
  publishing.enabled = true;
  const second = '00000000-0000-4000-8000-000000000099';
  const saved = structuredClone(intake);
  saved.snapshot.passengerIds = [passengerId, second];
  saved.snapshot.passengerAssignments = [
    {
      ...saved.snapshot.passengerAssignments![0]!,
      displayNameSnapshot: 'ALPHA PERSON',
    },
    {
      ...saved.snapshot.passengerAssignments![0]!,
      customerId: second,
      displayNameSnapshot: 'BETA PERSON',
    },
  ];
  saved.ticketDocuments = [passengerId, second].map((customerId, i) => ({
    customerId,
    number: String(100000 + i),
    issuedAt: '2026-10-01T08:00:00Z',
    source: 'AUTO',
  }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      Response.json({
        data: url.endsWith('/workflow')
          ? saved
          : url.endsWith('/passengers') || url.includes('airlines?')
            ? []
            : { name: 'CITY', attributes: {} },
      }),
    ),
  );
  const result = await GET(request('?format=share'), {
    params: Promise.resolve({ id }),
  });
  expect(result.status).toBe(200);
  expect(publishing.documents).toHaveLength(2);
  expect(publishing.documents[0]!.html).toContain('ALPHA PERSON');
  expect(publishing.documents[0]!.html).not.toContain('BETA PERSON');
  expect(publishing.documents[1]!.html).toContain('BETA PERSON');
  expect(publishing.documents[1]!.html).not.toContain('ALPHA PERSON');
  expect(publishing.documents[0]!.html).toContain(publishing.documents[0]!.url);
  expect(publishing.documents[1]!.html).not.toContain(
    publishing.documents[0]!.url,
  );
  expect(renderer).not.toHaveBeenCalled();
});
it('cannot publish a public ticket through an unauthorized request', async () => {
  publishing.enabled = true;
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(null, { status: 403 })),
  );
  expect(
    (await GET(request('?format=share'), { params: Promise.resolve({ id }) }))
      .status,
  ).toBe(403);
  expect(publishing.documents).toHaveLength(0);
});
