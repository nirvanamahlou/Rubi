import { describe, expect, it, vi } from 'vitest';
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
      websitePublication: {
        findUnique: vi.fn().mockResolvedValue({ enabled: true }),
        findMany: vi.fn().mockResolvedValue([]),
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
  const tickets = { websiteOffer: vi.fn().mockResolvedValue(flight) };
  const output = { prepare: vi.fn().mockResolvedValue({ data: { contract } }) };
  const travel = {
    forContract: vi.fn().mockResolvedValue({
      workflow: { supplierStatus: 'PENDING' },
      snapshot: { serviceSelections: [] },
      ticketDocuments: [],
    }),
  };
  const delivery = {
    readCustomerContract: vi.fn().mockResolvedValue({ approved: false }),
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
  );
  return { service, db, sales, tickets, contract, link, delivery, output };
}

describe('website connection policy', () => {
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
