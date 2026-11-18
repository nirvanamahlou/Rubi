import { describe, it, expect, vi, afterEach } from 'vitest';
import type {
  SalesContractCreateRequest,
  AuthenticatedActor,
} from '@nora/contracts';
import { WebsiteCheckoutHoldsService } from './website-checkout-holds.service';
import { stableFingerprint } from './site-commerce.policy';
const actor = {
  userId: 'qa-user',
  branchIds: ['qa-branch'],
  permissions: ['sales.contracts.create'],
} as AuthenticatedActor;
const oldBinding = process.env.SITE_COMMERCE_BINDINGS;
afterEach(() => {
  if (oldBinding === undefined) delete process.env.SITE_COMMERCE_BINDINGS;
  else process.env.SITE_COMMERCE_BINDINGS = oldBinding;
});
const flight = {
  id: 'qa-offer',
  originId: 'qa-origin',
  destinationId: 'qa-dest',
  departureAt: '2099-01-01T10:00:00.000Z',
  arrivalAt: '2099-01-01T12:00:00.000Z',
  carrierName: 'Synthetic',
  serviceNumber: 'QA',
  cabinClassCode: 'ECONOMY',
};
const quote = { amount: '1000', currencyCode: 'IRR' };
function input() {
  return {
    customerId: 'qa-person',
    originId: flight.originId,
    destinationId: flight.destinationId,
    departureDate: '2099-01-01',
    tripType: 'ONE_WAY',
    buyerContact: {
      name: 'Synthetic buyer',
      phone: '00000000000',
      address: 'QA',
      postalCode: '0000000000',
    },
    passengers: [
      {
        customerId: 'qa-person',
        displayNameSnapshot: 'Synthetic passenger',
        ageCategory: 'ADT',
        birthDate: '2000-01-01',
        serviceClientKeys: ['out'],
      },
    ],
    services: [
      { kind: 'FLIGHT', clientKey: 'out', titleSnapshot: 'Synthetic flight' },
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
        serviceClientKey: 'out',
        quotedPrice: quote,
      },
    ],
    priceComponents: [{ ...quote, type: 'BASE', title: 'Synthetic' }],
  } as SalesContractCreateRequest;
}
function harness(status = 'VERIFIED') {
  process.env.SITE_COMMERCE_BINDINGS = JSON.stringify({
    qa: { userId: actor.userId, branchId: actor.branchIds[0] },
  });
  const row = {
    id: 'qa-session',
    status,
    branchId: 'qa-branch',
    expiresAt: new Date(Date.now() + 600000),
    requesterName: 'Synthetic buyer',
    requesterPhone: '00000000000',
    paymentAttemptKey: 'qa-payment-attempt-1',
    quoteSnapshot: {
      offerIds: [flight.id],
      offers: [flight],
      birthDates: ['2000-01-01'],
      quotes: [quote],
      priceComponents: [quote],
      tourId: null,
      targetId: 'qa-target',
      frozenPackageSales: [],
      fingerprints: { private: 'not-public' },
    },
  };
  const update = vi
    .fn()
    .mockImplementation(async ({ data }) => Object.assign(row, data));
  const tx = {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    websiteCheckoutSession: {
      findUnique: vi.fn().mockResolvedValue(row),
      findUniqueOrThrow: vi.fn().mockResolvedValue(row),
      update,
    },
    customer: { create: vi.fn() },
    salesContract: { create: vi.fn() },
  };
  const db = {
    client: {
      ...tx,
      $transaction: async (fn: (t: unknown) => unknown) => fn(tx),
    },
  };
  const capacity = { pin: vi.fn(), bind: vi.fn(), releaseFailed: vi.fn() };
  const proof = { resolve: vi.fn().mockResolvedValue({ amount: '1000' }) };
  const service = new WebsiteCheckoutHoldsService(
    db as never,
    {} as never,
    {} as never,
    {} as never,
    capacity as never,
    {} as never,
    proof as never,
  );
  return { row, tx, service, capacity, proof };
}
describe('verified checkout draft witness and transitions', () => {
  it('permits exact frozen last-seat quote without calling public availability', async () => {
    const h = harness();
    expect(
      await h.service.validateDraft('qa', 'checkout', input(), actor),
    ).toEqual({ frozenPackageSales: [], targetId: 'qa-target' });
    expect(h.tx.customer.create).not.toHaveBeenCalled();
    expect(h.tx.salesContract.create).not.toHaveBeenCalled();
  });
  it('rejects unpaid witness before native customer or contract creation', async () => {
    const h = harness('PAYMENT_PENDING');
    await expect(
      h.service.validateDraft('qa', 'checkout', input(), actor),
    ).rejects.toThrow();
    expect(h.tx.customer.create).not.toHaveBeenCalled();
    expect(h.tx.salesContract.create).not.toHaveBeenCalled();
  });
  it('rejects changed price, DOB, buyer, route, leg direction or extra services', async () => {
    const h = harness();
    const variations = [
      { priceComponents: [{ ...quote, amount: '999', type: 'BASE' }] },
      { passengers: [{ birthDate: '2020-01-01', serviceClientKeys: ['out'] }] },
      { buyerContact: { ...input().buyerContact, name: 'Other' } },
      {
        ticketSelections: [
          { ...input().ticketSelections![0], direction: 'RETURN' },
        ],
      },
      {
        ticketSelections: [
          {
            ...input().ticketSelections![0],
            arrivalAt: '2099-01-01T13:00:00.000Z',
          },
        ],
      },
      { services: [...input().services, { kind: 'VISA', clientKey: 'extra' }] },
    ];
    for (const change of variations)
      await expect(
        h.service.validateDraft(
          'qa',
          'checkout',
          { ...input(), ...change } as SalesContractCreateRequest,
          actor,
        ),
      ).rejects.toThrow();
  });
  it('protects hold contact and internal fingerprints in website status', async () => {
    const h = harness('PAYMENT_PENDING');
    const response = await h.service.status('qa', 'checkout', actor);
    expect(response.data).toMatchObject({
      paymentPending: true,
      offerIds: [flight.id],
    });
    for (const key of [
      'requesterName',
      'requesterPhone',
      'fingerprints',
      'offers',
      'targetId',
      'frozenPackageSales',
    ])
      expect(response.data).not.toHaveProperty(key);
  });
  it('cannot resolve another payment attempt or unverified bank failure', async () => {
    const h = harness('PAYMENT_PENDING');
    await expect(
      h.service.resolve(
        'qa',
        'checkout',
        { attemptKey: 'another', outcome: 'VERIFIED' },
        actor,
      ),
    ).rejects.toThrow();
    await expect(
      h.service.resolve(
        'qa',
        'checkout',
        { attemptKey: h.row.paymentAttemptKey, outcome: 'FAILED' },
        actor,
      ),
    ).rejects.toThrow();
    expect(h.capacity.releaseFailed).not.toHaveBeenCalled();
  });
  it('successful proof pins capacity through delayed settlement and rejects changed amount', async () => {
    const h = harness('PAYMENT_PENDING');
    const gatewayReceipt = { reference: 'qa-bank' } as never;
    await h.service.resolve(
      'qa',
      'checkout',
      {
        attemptKey: h.row.paymentAttemptKey,
        outcome: 'VERIFIED',
        gatewayReceipt,
      },
      actor,
    );
    expect(h.row.status).toBe('VERIFIED');
    expect(h.capacity.releaseFailed).not.toHaveBeenCalled();
    expect(h.row).toHaveProperty(
      'resolutionFingerprint',
      stableFingerprint(gatewayReceipt),
    );
    const other = harness('PAYMENT_PENDING');
    other.proof.resolve.mockResolvedValue({ amount: '999' });
    await expect(
      other.service.resolve(
        'qa',
        'checkout',
        {
          attemptKey: other.row.paymentAttemptKey,
          outcome: 'VERIFIED',
          gatewayReceipt,
        },
        actor,
      ),
    ).rejects.toThrow();
    expect(other.tx.websiteCheckoutSession.update).not.toHaveBeenCalled();
  });
  it('same pending payment replay does not create people or contracts', async () => {
    const h = harness('PAYMENT_PENDING'),
      expiry = h.row.expiresAt;
    await h.service.pin('qa', 'checkout', h.row.paymentAttemptKey, actor);
    expect(h.row.expiresAt).toBe(expiry);
    expect(h.capacity.pin).toHaveBeenCalledTimes(1);
    expect(h.tx.customer.create).not.toHaveBeenCalled();
    expect(h.tx.salesContract.create).not.toHaveBeenCalled();
  });
  it('rejects wrong site principal or branch before reading checkout', async () => {
    const h = harness();
    await expect(
      h.service.status('qa', 'checkout', { ...actor, userId: 'other' }),
    ).rejects.toThrow();
    await expect(
      h.service.status('qa', 'checkout', { ...actor, branchIds: [] }),
    ).rejects.toThrow();
    expect(h.tx.websiteCheckoutSession.findUnique).not.toHaveBeenCalled();
  });
  it('preparation replay preserves first expiry and rejects changed composition or expired checkout', async () => {
    const h = harness('PREPARED'),
      body = {
        productIds: ['10000000-0000-4000-8000-000000000001'],
        birthDates: ['2000-01-01'],
        customerExternalId: 'qa-customer',
        requesterName: h.row.requesterName,
        requesterPhone: h.row.requesterPhone,
      };
    Object.assign(h.row, { fingerprint: stableFingerprint(body) });
    const expiry = h.row.expiresAt;
    expect(
      (await h.service.prepare('qa', 'checkout', body, actor)).data.expiresAt,
    ).toBe(expiry.toISOString());
    expect(h.tx.$executeRaw).toHaveBeenCalledOnce();
    await expect(
      h.service.prepare(
        'qa',
        'checkout',
        { ...body, birthDates: ['2010-01-01'] },
        actor,
      ),
    ).rejects.toThrow();
    h.row.expiresAt = new Date(0);
    await expect(
      h.service.prepare('qa', 'checkout', body, actor),
    ).rejects.toThrow();
    expect(h.tx.customer.create).not.toHaveBeenCalled();
    expect(h.tx.salesContract.create).not.toHaveBeenCalled();
  });
});
