import { afterEach, describe, expect, it, vi } from 'vitest';
import type {
  AuthenticatedActor,
  SalesContractCreateRequest,
  TicketOfferV1,
} from '@nora/contracts';
import { SiteCommerceService } from './site-commerce.service';
import {
  assertWebsiteDraft,
  externalOrderId,
  siteBinding,
  stableFingerprint,
} from './site-commerce.policy';
import { websiteFlightQuotes } from './ticket-quote';
import { validateSalesContract } from '../sales/sales.domain';

const ids = {
  user: '00000000-0000-4000-8000-000000000001',
  branch: '00000000-0000-4000-8000-000000000002',
  origin: '00000000-0000-4000-8000-000000000003',
  destination: '00000000-0000-4000-8000-000000000004',
  offer: '00000000-0000-4000-8000-000000000005',
  person: '00000000-0000-4000-8000-000000000006',
};
const actor = {
  userId: ids.user,
  branchIds: [ids.branch],
  permissions: ['sales.contracts.create', 'ticket_catalog.manage'],
} as AuthenticatedActor;
const binding = JSON.stringify({
  nss: { userId: ids.user, branchId: ids.branch },
});
afterEach(() => vi.unstubAllEnvs());
const flight = {
  id: ids.offer,
  version: 1,
  branchId: ids.branch,
  originId: ids.origin,
  destinationId: ids.destination,
  departureAt: '2030-01-01T08:00:00.000Z',
  arrivalAt: '2030-01-01T10:00:00.000Z',
  carrierName: 'Synthetic',
  serviceNumber: 'SY123',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 20,
  remainingCapacity: 20,
  allocatedCapacity: 0,
  reservedCapacity: 0,
  status: 'ACTIVE',
  standaloneSalePrice: { revision: 1, amount: '123.45', currencyCode: 'EUR' },
} satisfies TicketOfferV1;
function draft(): SalesContractCreateRequest {
  return {
    customerId: ids.person,
    originId: ids.origin,
    destinationId: ids.destination,
    departureDate: '2030-01-01',
    tripType: 'ONE_WAY',
    services: [
      {
        kind: 'FLIGHT',
        clientKey: 'flight-outbound',
        titleSnapshot: 'Synthetic',
        referenceId: ids.offer,
        metadata: {
          direction: 'OUTBOUND',
          catalogSalePriceTargetId: '00000000-0000-4000-8000-000000000010',
          catalogSaleQuoteVersion: 1,
          catalogSaleQuoteAmount: '123.45',
          catalogSaleQuoteCurrency: 'EUR',
        },
      },
    ],
    passengers: [
      {
        customerId: ids.person,
        displayNameSnapshot: 'Synthetic Traveller',
        birthDate: '2000-01-01',
        ageCategory: 'ADT',
        serviceClientKeys: ['flight-outbound'],
      },
    ],
    ticketSelections: [
      {
        offerId: flight.id,
        direction: 'OUTBOUND',
        originId: flight.originId,
        destinationId: flight.destinationId,
        departureAt: flight.departureAt,
        arrivalAt: flight.arrivalAt,
        carrierNameSnapshot: flight.carrierName,
        serviceNumberSnapshot: flight.serviceNumber,
        cabinClassCode: flight.cabinClassCode,
        serviceClientKey: 'flight-outbound',
        quotedPrice: { amount: '123.45', currencyCode: 'EUR' },
      },
    ],
    priceComponents: [
      { type: 'BASE', title: 'ERP', amount: '123.45', currencyCode: 'EUR' },
    ],
  };
}
function fixture() {
  vi.stubEnv('SITE_COMMERCE_BINDINGS', binding);
  const contract = {
    id: 'contract-1',
    version: 1,
    ownerUserId: ids.user,
    passengersDetail: draft().passengers,
    createdAt: '2026-11-25T00:00:00Z',
    branchId: ids.branch,
    contractNumber: 'ERP-1',
    status: 'DRAFT',
    balances: [{ amount: '123.45', currencyCode: 'EUR' }],
    ticketSelections: draft().ticketSelections,
    servicesDetail: draft().services,
    hotelSelection: null,
  };
  const link = {
    id: 'link-1',
    siteCode: 'nss',
    branchId: ids.branch,
    externalId: 'order-1',
    contractId: contract.id,
    fingerprint: stableFingerprint(draft()),
    paymentFingerprint: null as string | null,
    paymentCommands: null as unknown,
  };
  let saved = false;
  const db = {
    client: {
      $queryRaw: vi.fn().mockResolvedValue([{ id: ids.offer }]),
      $transaction: <T>(callback: (tx: unknown) => T): T => callback(db.client),
      websiteCatalogDelivery: {
        findUnique: vi.fn().mockResolvedValue({
          branchId: ids.branch,
          salePriceTargetId: '00000000-0000-4000-8000-000000000010',
        }),
      },
      websitePublication: {
        create: vi.fn().mockImplementation(async ({ data }) => ({
          ...data,
          id: 'publication-1',
          version: 1,
        })),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi
          .fn()
          .mockResolvedValue({ enabled: false, version: 2 }),
        findFirst: vi.fn().mockResolvedValue({ resourceId: ids.offer }),
        findUnique: vi.fn().mockResolvedValue({ enabled: true }),
        findMany: vi.fn().mockResolvedValue([]),
      },
      reservationIntake: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      websiteOrder: {
        findUnique: vi
          .fn()
          .mockImplementation(async () => (saved ? link : null)),
        upsert: vi.fn().mockImplementation(async () => {
          saved = true;
          return link;
        }),
        findUniqueOrThrow: vi.fn().mockImplementation(async () => link),
        updateMany: vi.fn().mockImplementation(async ({ data }) => {
          Object.assign(link, data);
          return { count: 1 };
        }),
      },
    },
  };
  const sales = {
    financeCustomerDocumentDeliveryFacts: vi.fn().mockResolvedValue({
      cancelled: false,
      hasConfirmedPayment: false,
      fullySettled: false,
    }),
    createdByKey: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ data: contract }),
    detail: vi.fn().mockImplementation(async () => ({ data: contract })),
    addPayment: vi.fn().mockImplementation(async () => {
      contract.version++;
    }),
    confirm: vi.fn().mockImplementation(async () => {
      contract.status = 'CONFIRMED';
    }),
  };
  const tickets = {
    documentSupply: vi.fn().mockResolvedValue({}),
    websiteOffer: vi.fn().mockResolvedValue(flight),
  };
  const output = { prepare: vi.fn().mockResolvedValue({ data: { contract } }) };
  const travel = {
    forContract: vi.fn().mockResolvedValue({
      id: 'intake-1',
      workflow: { supplierStatus: 'PENDING' },
      snapshot: { serviceSelections: [] },
      ticketDocuments: [],
    }),
  };
  const delivery = {
    readCustomerContract: vi.fn().mockResolvedValue({ approved: false }),
  };
  const insurance = {
    enqueue: vi.fn().mockResolvedValue(undefined),
    requestImmediate: vi.fn(),
    summary: vi.fn().mockResolvedValue({
      policies: [
        {
          id: 'policy-1',
          passengerName: 'Synthetic Traveller',
          policyNumber: null,
          status: 'PENDING',
          ready: false,
          automatic: true,
          error: 'internal',
        },
      ],
    }),
  };
  const service = new SiteCommerceService(
    db as never,
    tickets as never,
    {} as never,
    {} as never,
    sales as never,
    output as never,
    {} as never,
    travel as never,
    delivery as never,
    {} as never,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    insurance as never,
  );
  return {
    service,
    db,
    sales,
    tickets,
    contract,
    link,
    delivery,
    output,
    insurance,
  };
}

describe('website test tour insurance', () => {
  it('only queues insurance for a settled tour with insurance included', async () => {
    vi.stubEnv('SITE_COMMERCE_TEST_TOUR_INSURANCE', 'true');
    const f = fixture();
    await f.service.draft('nss', 'order-1', draft(), actor);
    await expect(
      f.service.websiteTourInsurance('nss', 'order-1', actor, true),
    ).rejects.toHaveProperty('status', 404);

    const [leg] = f.contract.servicesDetail;
    f.contract.servicesDetail = [
      { ...leg!, metadata: { ...leg!.metadata, tourDepartureId: 'test-tour' } },
      { kind: 'HOTEL', clientKey: 'hotel', titleSnapshot: 'Test hotel' },
      {
        kind: 'INSURANCE',
        clientKey: 'insurance',
        titleSnapshot: 'Test policy',
      },
    ];
    await expect(
      f.service.websiteTourInsurance('nss', 'order-1', actor, true),
    ).rejects.toHaveProperty('status', 403);
    expect(f.insurance.enqueue).not.toHaveBeenCalled();

    f.sales.financeCustomerDocumentDeliveryFacts.mockResolvedValue({
      cancelled: false,
      hasConfirmedPayment: true,
      fullySettled: true,
    });
    f.delivery.readCustomerContract.mockResolvedValue({ approved: true });
    await expect(
      f.service.websiteTourInsurance('nss', 'order-1', actor),
    ).resolves.toEqual({
      data: {
        sandbox: true,
        policies: [
          {
            id: 'policy-1',
            passengerName: 'Synthetic Traveller',
            policyNumber: null,
            status: 'PENDING',
            ready: false,
          },
        ],
      },
    });
    expect(f.insurance.enqueue).not.toHaveBeenCalled();
    await f.service.websiteTourInsurance('nss', 'order-1', actor, true);
    expect(f.insurance.enqueue).toHaveBeenCalledExactlyOnceWith(
      'intake-1',
      true,
    );
    expect(f.insurance.requestImmediate).toHaveBeenCalledExactlyOnceWith(
      'policy-1',
    );
  });

  it('cannot use the sandbox provider in production', async () => {
    vi.stubEnv('SITE_COMMERCE_TEST_TOUR_INSURANCE', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    const f = fixture();
    await expect(
      f.service.websiteTourInsurance('nss', 'order-1', actor, true),
    ).rejects.toHaveProperty('status', 404);
    expect(f.insurance.enqueue).not.toHaveBeenCalled();
  });
});

describe('website connection policy', () => {
  it('rejects publishing to another staff-accessible branch outside the configured website binding', async () => {
    const f = fixture();
    f.tickets.websiteOffer.mockResolvedValue({
      ...flight,
      branchId: 'other-branch',
    });
    await expect(
      f.service.publish(
        'nss',
        'ticket',
        ids.offer,
        { enabled: true, version: 0, branchId: 'other-branch' },
        { ...actor, branchIds: [...actor.branchIds, 'other-branch'] },
      ),
    ).rejects.toThrow('این شعبه به سایت انتخاب‌شده دسترسی ندارد.');
    expect(f.tickets.documentSupply).not.toHaveBeenCalled();
    expect(f.db.client.websitePublication.create).not.toHaveBeenCalled();
    expect(f.db.client.websitePublication.updateMany).not.toHaveBeenCalled();
  });
  it('publishes in the bound branch and permits disabling it after its sale eligibility changes', async () => {
    const f = fixture();
    f.db.client.websitePublication.findUnique.mockResolvedValueOnce(null);
    const published = await f.service.publish(
      'nss',
      'ticket',
      ids.offer,
      { enabled: true, version: 0 },
      actor,
    );
    expect(published.data?.branchId).toBe(ids.branch);
    f.tickets.websiteOffer.mockRejectedValue(new Error('not sellable'));
    f.db.client.websitePublication.findUnique.mockResolvedValueOnce({
      id: 'old-publication',
      enabled: true,
      salesStopped: false,
      version: 1,
    });
    await f.service.publish(
      'nss',
      'ticket',
      ids.offer,
      { enabled: false, version: 1 },
      actor,
    );
    expect(f.db.client.websitePublication.updateMany).toHaveBeenCalledWith({
      where: { id: 'old-publication', version: 1 },
      data: {
        enabled: false,
        salesStopped: false,
        version: { increment: 1 },
      },
    });
    expect(f.tickets.websiteOffer).toHaveBeenCalledTimes(1);
    expect(f.tickets.documentSupply).toHaveBeenLastCalledWith(ids.offer, [
      ids.branch,
    ]);
  });
  it('is disabled by default and binds site to one real actor and branch', () => {
    expect(() => siteBinding('nss', actor, '{}')).toThrow();
    expect(siteBinding('nss', actor, binding).branchId).toBe(ids.branch);
    expect(() =>
      siteBinding('nss', { ...actor, userId: 'other' }, binding),
    ).toThrow();
    expect(() =>
      siteBinding('nss', { ...actor, branchIds: [] }, binding),
    ).toThrow();
    for (const raw of ['null', '[]', '{broken'])
      expect(() => siteBinding('nss', actor, raw)).toThrow();
  });
  it('rejects traversal, empty and oversized external identities', () => {
    for (const id of ['', '../other', 'a/b', 'x'.repeat(101)])
      expect(() => externalOrderId(id)).toThrow();
    expect(externalOrderId('nss-order:123')).toBe('nss-order:123');
  });
  it('hashes nested object order canonically without changing arrays or money strings', () => {
    expect(stableFingerprint({ b: { c: '1', a: '2' }, a: 1 })).toBe(
      stableFingerprint({ a: 1, b: { a: '2', c: '1' } }),
    );
    expect(stableFingerprint(['1', '2'])).not.toBe(
      stableFingerprint(['2', '1']),
    );
    expect(stableFingerprint('9007199254740993')).not.toBe(
      stableFingerprint('9007199254740992'),
    );
  });
  it('accepts the native contract and rejects owner overrides, draft payment and legacy price bypass', () => {
    expect(() => validateSalesContract(draft())).not.toThrow();
    expect(() => assertWebsiteDraft(draft())).not.toThrow();
    expect(() =>
      assertWebsiteDraft({ ...draft(), assignedUserId: ids.user }),
    ).toThrow();
    expect(() =>
      assertWebsiteDraft({
        ...draft(),
        priceComponents: [{ ...draft().priceComponents[0]!, type: 'DISCOUNT' }],
      }),
    ).toThrow();
    expect(() =>
      assertWebsiteDraft({
        ...draft(),
        services: [
          { ...draft().services[0]!, metadata: { legacyContractV1: true } },
        ],
      }),
    ).toThrow();
  });
});

describe('website ticket quotes', () => {
  it('keeps large amounts exact, including tier crossings with held seats', () => {
    const offers = {
      ...flight,
      allocatedCapacity: 1,
      reservedCapacity: 1,
      standaloneSalePrice: {
        revision: 1,
        amount: '9007199254740993',
        currencyCode: 'IRR',
        tiers: [
          { seatCount: 3, amount: '9007199254740993' },
          { seatCount: 17, amount: '9007199254740995' },
        ],
      },
    };
    expect(websiteFlightQuotes(offers, undefined, 2)[0]?.amount).toBe(
      '18014398509481988.00',
    );
    expect(() =>
      websiteFlightQuotes({ ...flight, remainingCapacity: 0 }, undefined, 1),
    ).toThrow();
  });
  it('uses pair prices once and splits odd cents without changing the total', () => {
    const returning = {
      ...flight,
      id: 'return',
      originId: flight.destinationId,
      destinationId: flight.originId,
      departureAt: '2030-01-04T08:00:00.000Z',
      arrivalAt: '2030-01-04T10:00:00.000Z',
    };
    const quotes = websiteFlightQuotes(
      {
        ...flight,
        roundTripSalePrices: [
          {
            returnOfferId: 'return',
            amount: '123.45',
            currencyCode: 'EUR',
            revision: 1,
          },
        ],
      },
      returning,
      1,
    );
    expect(quotes.map((p) => p.amount)).toEqual(['61.72', '61.73']);
    expect(() =>
      websiteFlightQuotes(
        flight,
        { ...returning, departureAt: '2029-01-01T08:00:00Z' },
        1,
      ),
    ).toThrow();
  });
});

describe('durable website orders', () => {
  it.each(['jahan-bastan', 'ghestiroo'])(
    'links an unpaid %s order into the reservation inbox exactly once',
    async (site) => {
      const f = fixture();
      vi.stubEnv(
        'SITE_COMMERCE_BINDINGS',
        JSON.stringify({ [site]: { userId: ids.user, branchId: ids.branch } }),
      );
      f.db.client.$queryRaw.mockResolvedValue([
        { id: ids.offer, status: 'DRAFT', version: 1 },
      ] as never);
      const result = await f.service.draft(site, 'order-1', draft(), actor);
      await f.service.draft(site, 'order-1', draft(), actor);
      expect(f.db.client.reservationIntake.create).toHaveBeenCalledTimes(1);
      expect(f.db.client.reservationIntake.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          contractId: f.contract.id,
          branchId: ids.branch,
          salesOwnerUserId: ids.user,
          snapshot: expect.objectContaining({
            passengerIds: [ids.person],
            contractNumber: 'ERP-1',
          }),
        }),
      });
      expect(result.data.paymentStatus).toBe('unpaid');
      expect(f.sales.addPayment).not.toHaveBeenCalled();
      expect(f.sales.confirm).not.toHaveBeenCalled();
    },
  );
  it('creates through native Sales, stamps provenance and replays without creating a second contract', async () => {
    const f = fixture();
    await f.service.draft('nss', 'order-1', draft(), actor);
    expect(
      f.sales.create.mock.calls[0]?.[0].services[0].metadata.sourceSite,
    ).toBe('nss');
    expect(f.sales.create.mock.calls[0]?.[1].branchIds).toEqual([ids.branch]);
    await f.service.draft('nss', 'order-1', draft(), actor);
    expect(f.sales.create).toHaveBeenCalledTimes(1);
    await expect(
      f.service.draft(
        'nss',
        'order-1',
        { ...draft(), pricingNotes: 'changed' },
        actor,
      ),
    ).rejects.toThrow();
  });
  it('rejects manual/unpublished services, spoofed schedules and modified prices before Sales writes', async () => {
    const f = fixture();
    await expect(
      f.service.draft(
        'nss',
        'order-1',
        {
          ...draft(),
          priceComponents: [{ ...draft().priceComponents[0]!, amount: '1' }],
        },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      f.service.draft(
        'nss',
        'order-1',
        {
          ...draft(),
          ticketSelections: [
            {
              ...draft().ticketSelections![0]!,
              serviceNumberSnapshot: 'forged',
            },
          ],
        },
        actor,
      ),
    ).rejects.toThrow();
    f.db.client.websitePublication.findUnique.mockResolvedValue({
      enabled: false,
    });
    await expect(
      f.service.draft('nss', 'order-1', draft(), actor),
    ).rejects.toThrow();
    expect(f.sales.create).not.toHaveBeenCalled();
  });
  it('blocks new orders when website-only sales are stopped', async () => {
    const f = fixture();
    f.db.client.websitePublication.findUnique.mockResolvedValue({
      enabled: true,
      salesStopped: true,
    });
    await expect(
      f.service.draft('nss', 'order-1', draft(), actor),
    ).rejects.toThrow();
    expect(f.sales.create).not.toHaveBeenCalled();
  });
  it('does not expose an unrelated order, even with the right site account', async () => {
    const f = fixture();
    await expect(f.service.status('nss', 'missing', actor)).rejects.toThrow();
    expect(f.sales.detail).not.toHaveBeenCalled();
    await expect(
      f.service.catalog('nss', { ...actor, userId: 'other' }),
    ).rejects.toThrow();
  });
  it('resumes native payment commands with frozen versions, not new mutable versions', async () => {
    const f = fixture();
    await f.service.draft('nss', 'order-1', draft(), actor);
    const payments = [
      {
        amount: '123.45',
        currencyCode: 'EUR',
        method: 'BANK_TRANSFER',
        dueAt: '2030-01-01T00:00:00Z',
        paymentReference: 'synthetic-verified-payment',
      },
    ] as never;
    await f.service.paid('nss', 'order-1', payments, actor);
    const first = f.sales.addPayment.mock.calls[0];
    await f.service.paid('nss', 'order-1', payments, actor);
    expect(f.sales.addPayment.mock.calls[1]).toEqual(first);
    expect(f.sales.confirm).toHaveBeenCalledTimes(1);
  });
  it('keeps document delivery blocked until Finance approval', async () => {
    const f = fixture();
    await f.service.draft('nss', 'order-1', draft(), actor);
    await expect(
      f.service.travelDocuments('nss', 'order-1', actor),
    ).rejects.toThrow();
    f.delivery.readCustomerContract.mockResolvedValue({ approved: true });
    await expect(
      f.service.travelDocuments('nss', 'order-1', actor),
    ).resolves.toHaveProperty('data.ticketDocuments');
  });
});

describe('website ticket destination', () => {
  it('uses the bound destination and overwrites a browser-selected destination', async () => {
    const f = fixture();
    const request = draft();
    request.services[0]!.metadata = {
      ...request.services[0]!.metadata,
      catalogSalePriceTargetId: 'other',
    };
    await f.service.draft('nss', 'bound-rate', request, actor);
    expect(f.tickets.websiteOffer).toHaveBeenCalledWith(
      ids.offer,
      [ids.branch],
      '00000000-0000-4000-8000-000000000010',
    );
    expect(
      f.sales.create.mock.calls[0]?.[0].services[0].metadata
        .catalogSalePriceTargetId,
    ).toBe('00000000-0000-4000-8000-000000000010');
  });
  it('fails closed without a bound destination before creating a contract', async () => {
    const f = fixture();
    f.db.client.websiteCatalogDelivery.findUnique.mockResolvedValue(
      null as never,
    );
    await expect(
      f.service.draft('nss', 'unbound', draft(), actor),
    ).rejects.toThrow();
    expect(f.sales.create).not.toHaveBeenCalled();
  });
  it('keeps verified payment identity when the final native capacity reservation fails', async () => {
    const f = fixture();
    await f.service.draft('nss', 'sold-out', draft(), actor);
    f.sales.confirm.mockRejectedValueOnce(new Error('capacity changed'));
    const payment = {
      method: 'ONLINE_GATEWAY',
      paymentReference: 'synthetic-receipt',
      amount: '123.45',
      currencyCode: 'EUR',
      version: 1,
    } as never;
    await expect(
      f.service.paid('nss', 'sold-out', [payment], actor),
    ).rejects.toThrow('capacity changed');
    expect(f.link.paymentFingerprint).toBeTruthy();
    expect(f.contract.status).not.toBe('CONFIRMED');
    await f.service.paid('nss', 'sold-out', [payment], actor);
    expect(f.sales.confirm).toHaveBeenCalledTimes(2);
  });
});

describe('website age quote preview and exact birthday checks', () => {
  const publishedFare = {
    ...flight,
    standaloneSalePrice: {
      revision: 1,
      amount: '100',
      childAmount: '40',
      infantAmount: '10',
      currencyCode: 'IRR',
    },
  };
  it('previews declared groups without creating people, contracts or payments', async () => {
    const f = fixture();
    f.tickets.websiteOffer.mockResolvedValue(publishedFare);
    const result = await f.service.flightQuote(
      'nss',
      {
        productIds: ['publication'],
        passengerCounts: { adults: 1, children: 1, infants: 1 },
      },
      actor,
    );
    expect(result.data[0]).toMatchObject({
      amount: '150.00',
      currencyCode: 'IRR',
      pricingBreakdown: {
        version: 1,
        totalAmount: '150.00',
        passengers: [
          { category: 'ADT', amount: '100.00' },
          { category: 'CHD', amount: '40.00' },
          { category: 'INF', amount: '10.00' },
        ],
      },
    });
    expect(f.sales.create).not.toHaveBeenCalled();
    expect(f.sales.addPayment).not.toHaveBeenCalled();
    expect(f.db.client.websiteOrder.upsert).not.toHaveBeenCalled();
  });
  it('uses real birth dates at exact two/twelve-year boundaries', async () => {
    const f = fixture();
    f.tickets.websiteOffer.mockResolvedValue(publishedFare);
    const result = await f.service.flightQuote(
      'nss',
      {
        productIds: ['publication'],
        birthDates: ['2018-01-01', '2018-01-02', '2028-01-01', '2028-01-02'],
      },
      actor,
    );
    expect(result.data[0]?.amount).toBe('190.00');
    expect(
      result.data[0]?.pricingBreakdown?.passengers.map((p) => p.category),
    ).toEqual(['ADT', 'CHD', 'CHD', 'INF']);
  });
  it.each([
    { passengerCounts: { adults: 1.5, children: 0, infants: 0 } },
    { passengerCounts: { adults: 0, children: 0, infants: 1 } },
    { passengerCounts: { adults: 30, children: 1, infants: 0 } },
    { passengerCounts: { adults: 1, children: -1, infants: 0 } },
    {
      passengerCounts: { adults: 1, children: 0, infants: 0 },
      birthDates: ['2000-01-01'],
    },
  ])('rejects malformed or ambiguous preview %#', async (input) => {
    const f = fixture();
    await expect(
      f.service.flightQuote(
        'nss',
        { productIds: ['publication'], ...input },
        actor,
      ),
    ).rejects.toThrow();
    expect(f.tickets.websiteOffer).not.toHaveBeenCalled();
  });
});

it('isolates concurrent quotes, contracts and documents for two sites sharing HQ inventory', async () => {
  const f = fixture();
  const sites = ['nss', 'jahan-bastan'] as const;
  const records = sites.map((site, i) => ({
    site,
    actor: { ...actor, userId: 'site-user-' + i },
    target: 'target-' + i,
    amount: i ? '213.00' : '105.00',
    order: 'order-' + i,
    contract: 'contract-' + i,
  }));
  vi.stubEnv(
    'SITE_COMMERCE_BINDINGS',
    JSON.stringify(
      Object.fromEntries(
        records.map((r) => [
          r.site,
          { userId: r.actor.userId, branchId: ids.branch },
        ]),
      ),
    ),
  );
  const { client } = f.db;
  client.websiteCatalogDelivery.findUnique.mockImplementation(
    async ({ where }) => ({
      branchId: ids.branch,
      salePriceTargetId: records.find((r) => r.site === where.siteCode)!.target,
    }),
  );
  client.websitePublication.findFirst.mockImplementation(async ({ where }) =>
    where.branchId === ids.branch &&
    where.id === 'publication-' + where.siteCode
      ? { resourceId: ids.offer }
      : null,
  );
  f.tickets.websiteOffer.mockImplementation(
    async (offerId, branches, targetId) => {
      expect([offerId, branches]).toEqual([ids.offer, [ids.branch]]);
      return {
        ...flight,
        standaloneSalePrice: {
          ...flight.standaloneSalePrice,
          amount: records.find((r) => r.target === targetId)!.amount,
        },
      };
    },
  );
  client.websiteOrder.findUnique.mockImplementation(async ({ where }) => {
    const { siteCode, branchId, externalId } =
      where.siteCode_branchId_externalId;
    const record = records.find(
      (r) =>
        r.site === siteCode &&
        r.order === externalId &&
        branchId === ids.branch,
    );
    return record ? { ...f.link, contractId: record.contract } : null;
  });
  f.delivery.readCustomerContract.mockResolvedValue({ approved: true });
  await Promise.all(
    records.map(async (r, i) => {
      const other = records[1 - i]!;
      const quote = await f.service.flightQuote(
        r.site,
        {
          productIds: ['publication-' + r.site],
          birthDates: ['2000-01-01'],
        },
        r.actor,
      );
      expect(quote.data[0]?.amount).toBe(r.amount);
      await f.service.contractOutput(r.site, r.order, r.actor);
      await expect(
        f.service.travelDocuments(r.site, r.order, r.actor),
      ).resolves.toHaveProperty('data.ticketDocuments');
      expect(f.delivery.readCustomerContract).toHaveBeenCalledWith(r.contract);
      expect(f.output.prepare).toHaveBeenCalledWith(r.contract, r.actor);
      await expect(
        f.service.contractOutput(r.site, other.order, r.actor),
      ).rejects.toThrow();
      await expect(
        f.service.travelDocuments(r.site, other.order, r.actor),
      ).rejects.toThrow();
      await expect(
        f.service.travelDocuments(other.site, other.order, r.actor),
      ).rejects.toThrow();
    }),
  );
  expect(f.delivery.readCustomerContract).toHaveBeenCalledTimes(2);
});
