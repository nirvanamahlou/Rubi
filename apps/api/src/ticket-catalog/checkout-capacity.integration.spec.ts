import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import { TicketPublicService } from './ticket-public.service';
import { ProcurementPublicService } from '../procurement/procurement-public.service';
import { CheckoutTicketCapacity } from './checkout-ticket-capacity';
import { checkoutQuoteFingerprint } from './checkout-hold-policy';
import { liveCapacityHolds } from './live-capacity-holds';
const url = process.env.CHECKOUT_HOLD_TEST_DATABASE_URL;
describe.skipIf(!url)('isolated PostgreSQL checkout inventory', () => {
  let db: ReturnType<typeof createDatabaseClient>, tickets: TicketPublicService;
  const branchId = randomUUID(),
    userId = randomUUID(),
    capacity = new CheckoutTicketCapacity();
  const actor = {
    userId,
    branchIds: [branchId],
    permissions: ['ticket_catalog.manage', 'ticket_catalog.read'],
  } as AuthenticatedActor;
  beforeAll(async () => {
    if (
      !url ||
      !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) ||
      !new URL(url).pathname.startsWith('/rubi_checkout_hold_test_')
    )
      throw Error('Isolated synthetic database required');
    db = createDatabaseClient(url);
    await db.user.create({
      data: {
        id: userId,
        username: 'qa-' + userId,
        displayName: 'Synthetic QA',
        passwordHash: 'INVALID-NO-LOGIN',
      },
    });
    await db.branch.create({
      data: { id: branchId, code: 'QA-' + branchId, name: 'Synthetic QA' },
    });
    const database = { client: db };
    tickets = new TicketPublicService(
      database as never,
      new ProcurementPublicService(database as never),
    );
  }, 60000);
  afterAll(async () => {
    await db?.$disconnect();
  });
  const offer = async (number: string, quantity = 1) =>
    (
      await tickets.publish(
        {
          originId: randomUUID(),
          destinationId: randomUUID(),
          departureAt: '2099-10-01T10:00:00Z',
          arrivalAt: '2099-10-01T12:00:00Z',
          carrierName: 'Synthetic QA',
          serviceNumber: number,
          cabinClassCode: 'ECONOMY',
          totalCapacity: quantity,
        },
        actor,
        branchId,
        'ticket-catalog:qa-' + randomUUID(),
      )
    ).data.id;
  const lease = async () =>
    db.websiteCheckoutSession.create({
      data: {
        siteCode: 'qa',
        branchId,
        createdByUserId: userId,
        externalId: randomUUID(),
        customerExternalId: randomUUID(),
        fingerprint: 'a'.repeat(64),
        quoteSnapshot: {},
        requesterName: 'Synthetic buyer',
        requesterPhone: '00000000000',
        expiresAt: new Date(Date.now() + 600000),
      },
    });
  const acquire = async (
    ids: string[],
    row: Awaited<ReturnType<typeof lease>>,
  ) =>
    db.$transaction(
      (tx) =>
        capacity.prepare(
          tx,
          row,
          ids,
          { adults: 1, children: 0, infants: 1 },
          async () => ({
            snapshot: { ok: true },
            fingerprints: Object.fromEntries(
              ids.map((id) => [id, 'b'.repeat(64)]),
            ),
          }),
        ),
      { timeout: 15000 },
    );
  it('concurrent last-seat requests yield exactly one hold and never oversell', async () => {
    const id = await offer('LAST'),
      a = await lease(),
      b = await lease();
    const results = await Promise.allSettled([
      acquire([id], a),
      acquire([id], b),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rows = await db.ticketOfferCapacityHold.findMany({
      where: { offerId: id, ...liveCapacityHolds() },
    });
    expect(rows.reduce((n, h) => n + h.quantity, 0)).toBe(1);
  }, 30000);
  it('roundtrip with unavailable return acquires neither direction', async () => {
    const out = await offer('OUT'),
      back = await offer('BACK');
    await acquire([back], await lease());
    const row = await lease();
    await expect(acquire([out, back], row)).rejects.toThrow();
    expect(
      await db.ticketOfferCapacityHold.count({
        where: { checkoutSessionId: row.id },
      }),
    ).toBe(0);
    expect(
      (await tickets.managed(actor)).data.find((o) => o.id === out)
        ?.remainingCapacity,
    ).toBe(1);
  }, 30000);
  it('pins one attempt, never renews expiry and keeps unknown bank result counted', async () => {
    const id = await offer('PENDING'),
      row = await lease(),
      attempt = 'payment-attempt-0001';
    await acquire([id], row);
    await db.$transaction((tx) => capacity.pin(tx, row.id, branchId, attempt));
    const original = await db.ticketOfferCapacityHold.findFirstOrThrow({
      where: { checkoutSessionId: row.id },
    });
    await db.ticketOfferCapacityHold.update({
      where: { id: original.id },
      data: {
        createdAt: new Date(Date.now() - 601000),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await db.$transaction((tx) => capacity.pin(tx, row.id, branchId, attempt));
    expect(
      (
        await db.ticketOfferCapacityHold.findUniqueOrThrow({
          where: { id: original.id },
        })
      ).expiresAt.getTime(),
    ).toBeLessThan(Date.now());
    expect(
      (await tickets.managed(actor)).data.find((o) => o.id === id)
        ?.remainingCapacity,
    ).toBe(0);
    await expect(
      db.$transaction((tx) =>
        capacity.pin(tx, row.id, branchId, 'different-attempt-0002'),
      ),
    ).rejects.toThrow();
    await expect(acquire([id], await lease())).rejects.toThrow();
    await db.$transaction((tx) =>
      capacity.releaseFailed(tx, row.id, branchId, attempt),
    );
    expect(
      (await tickets.managed(actor)).data.find((o) => o.id === id)
        ?.remainingCapacity,
    ).toBe(1);
  }, 30000);
  it('expired unpinned reservation cannot enter bank and becomes available', async () => {
    const id = await offer('EXPIRED'),
      row = await lease();
    await acquire([id], row);
    await db.ticketOfferCapacityHold.updateMany({
      where: { checkoutSessionId: row.id },
      data: {
        createdAt: new Date(Date.now() - 601000),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    await expect(
      db.$transaction((tx) =>
        capacity.pin(tx, row.id, branchId, 'expired-attempt-0001'),
      ),
    ).rejects.toThrow();
    await expect(acquire([id], await lease())).resolves.toEqual({ ok: true });
  }, 30000);
  it('roster exposes buyer only to branch-authorized operators', async () => {
    const id = await offer('ROSTER');
    await acquire([id], await lease());
    expect((await capacity.roster(db, id, actor)).data[0]?.requesterPhone).toBe(
      '00000000000',
    );
    await expect(
      capacity.roster(db, id, { ...actor, permissions: [] }),
    ).rejects.toThrow();
    await expect(
      capacity.roster(db, id, { ...actor, branchIds: [] }),
    ).rejects.toThrow();
  });
  it('atomically consumes its pinned hold into one permanent allocation and replays bind/confirm', async () => {
    const id = await offer('CONSUME'),
      row = await lease(),
      attempt = 'consume-attempt-0001',
      quote = { amount: '1000', currencyCode: 'IRR' };
    await db.$transaction((tx) =>
      capacity.prepare(
        tx,
        row,
        [id],
        { adults: 1, children: 0, infants: 0 },
        async () => ({
          snapshot: {},
          fingerprints: { [id]: checkoutQuoteFingerprint(quote) },
        }),
      ),
    );
    await db.$transaction((tx) => capacity.pin(tx, row.id, branchId, attempt));
    const native = await db.ticketPublishedOffer.findUniqueOrThrow({
      where: { id },
    });
    const contract = await db.salesContract.create({
      data: {
        branchId,
        ownerUserId: userId,
        customerId: randomUUID(),
        payerCustomerId: randomUUID(),
        contractNumber: randomUUID(),
        customerNameSnapshot: 'Synthetic QA',
        tripType: 'ONE_WAY',
        originId: native.originId,
        destinationId: native.destinationId,
        departureDate: native.departureAt,
        createIdempotencyKey: randomUUID(),
        createRequestFingerprint: 'a'.repeat(64),
      },
    });
    await db.$transaction((tx) =>
      capacity.bind(tx, row.id, branchId, contract.id),
    );
    const selection = {
      offerId: id,
      direction: 'OUTBOUND' as const,
      serviceClientKey: 'out',
      originId: native.originId,
      destinationId: native.destinationId,
      departureAt: native.departureAt.toISOString(),
      arrivalAt: native.arrivalAt.toISOString(),
      carrierNameSnapshot: native.carrierName,
      serviceNumberSnapshot: native.serviceNumber,
      cabinClassCode: 'ECONOMY' as const,
    };
    expect(
      await tickets.reserve([selection], branchId, contract.id, 1, {
        out: quote,
      }),
    ).toMatchObject({ available: true });
    expect(
      await db.ticketOfferCapacityHold.findFirstOrThrow({
        where: { checkoutSessionId: row.id },
      }),
    ).toMatchObject({ status: 'CONSUMED' });
    expect(
      await db.ticketOfferCapacityAllocation.count({
        where: { contractId: contract.id, status: 'ACTIVE' },
      }),
    ).toBe(1);
    await expect(
      db.$transaction((tx) => capacity.bind(tx, row.id, branchId, contract.id)),
    ).resolves.toBeUndefined();
    expect(
      await tickets.reserve([selection], branchId, contract.id, 1, {
        out: quote,
      }),
    ).toMatchObject({ available: true, createdAllocationIds: [] });
    expect(
      (await tickets.managed(actor)).data.find((o) => o.id === id)
        ?.remainingCapacity,
    ).toBe(0);
    expect(
      await db.ticketOfferCapacityAllocation.count({
        where: { contractId: contract.id },
      }),
    ).toBe(1);
  }, 30000);

  it('refreshes the roster after ordinary expiry and proves those seats are genuinely reservable again', async () => {
    const id = await offer('ROSTER-EXPIRY', 2),
      session = await lease();
    await acquire([id], session);
    const before = await capacity.roster(db, id, actor);
    expect(before.data).toHaveLength(1);
    expect(before.data[0]).toMatchObject({
      externalId: session.externalId,
      siteCode: 'qa',
      quantity: 1,
    });
    expect(
      (await tickets.managed(actor)).data.find((o) => o.id === id)
        ?.remainingCapacity,
    ).toBe(1);
    await db.ticketOfferCapacityHold.updateMany({
      where: { checkoutSessionId: session.id },
      data: {
        createdAt: new Date(Date.now() - 601000),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    expect((await capacity.roster(db, id, actor)).data).toEqual([]);
    expect(
      (await tickets.managed(actor)).data.find((o) => o.id === id)
        ?.remainingCapacity,
    ).toBe(2);
    await expect(acquire([id], await lease())).resolves.toEqual({ ok: true });
  }, 30000);
  it('keeps an expired bank-pending order visible and occupied until an explicit failed-payment release', async () => {
    const id = await offer('ROSTER-PENDING'),
      session = await lease(),
      attempt = 'roster-pending-attempt-0001';
    await acquire([id], session);
    await db.$transaction((tx) =>
      capacity.pin(tx, session.id, branchId, attempt),
    );
    await db.ticketOfferCapacityHold.updateMany({
      where: { checkoutSessionId: session.id },
      data: {
        createdAt: new Date(Date.now() - 601000),
        expiresAt: new Date(Date.now() - 1000),
      },
    });
    const pending = await capacity.roster(db, id, actor);
    expect(pending.data).toHaveLength(1);
    expect(pending.data[0]).toMatchObject({
      externalId: session.externalId,
      remainingSeconds: null,
    });
    expect(
      (await tickets.managed(actor)).data.find((o) => o.id === id)
        ?.remainingCapacity,
    ).toBe(0);
    await db.$transaction((tx) =>
      capacity.releaseFailed(tx, session.id, branchId, attempt),
    );
    expect((await capacity.roster(db, id, actor)).data).toEqual([]);
    expect(
      (await tickets.managed(actor)).data.find((o) => o.id === id)
        ?.remainingCapacity,
    ).toBe(1);
  }, 30000);
});
