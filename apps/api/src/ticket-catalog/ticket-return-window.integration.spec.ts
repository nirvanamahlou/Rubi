import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '@nora/database';
import type {
  AuthenticatedActor,
  TicketOfferV1,
  TicketOfferCreateV1,
  SalesTicketSelectionInput,
} from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import { ProcurementPublicService } from '../procurement/procurement-public.service';
import { TicketPublicService } from './ticket-public.service';
const url = process.env.TICKET_RETURN_WINDOW_TEST_DATABASE_URL;
describe.skipIf(!url)('ticket return window on PostgreSQL', () => {
  let client: ReturnType<typeof createDatabaseClient>,
    service: TicketPublicService;
  let outbound: TicketOfferV1, allowed: TicketOfferV1, excluded: TicketOfferV1;
  const userId = randomUUID(),
    branchId = randomUUID(),
    originId = randomUUID(),
    destinationId = randomUUID();
  const actor = {
    userId,
    branchIds: [branchId],
    permissions: ['ticket_catalog.read', 'ticket_catalog.manage'],
  } as AuthenticatedActor;
  const selection = (
    offer: TicketOfferV1,
    direction: 'OUTBOUND' | 'RETURN',
  ): SalesTicketSelectionInput => ({
    serviceClientKey: direction,
    direction,
    offerId: offer.id,
    originId: offer.originId,
    destinationId: offer.destinationId,
    departureAt: offer.departureAt,
    arrivalAt: offer.arrivalAt,
    carrierNameSnapshot: offer.carrierName,
    serviceNumberSnapshot: offer.serviceNumber,
    cabinClassCode: offer.cabinClassCode,
  });
  beforeAll(async () => {
    if (
      !url ||
      !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
      !new URL(url).pathname.startsWith('/rubi_ticket_commission_0928_window_')
    )
      throw Error('Isolated synthetic return-window database required');
    client = createDatabaseClient(url);
    await client.user.create({
      data: {
        id: userId,
        username: 'qa-window-' + userId,
        displayName: 'Synthetic QA',
        passwordHash: 'INVALID-NO-LOGIN',
      },
    });
    await client.branch.create({
      data: {
        id: branchId,
        code: 'QA-' + branchId,
        name: 'Synthetic Return QA',
      },
    });
    const database = { client } as DatabaseService;
    service = new TicketPublicService(
      database,
      new ProcurementPublicService(database),
    );
    const base: TicketOfferCreateV1 = {
      originId,
      destinationId,
      departureAt: '2099-10-03T10:00:00Z',
      arrivalAt: '2099-10-03T12:00:00Z',
      carrierName: 'Synthetic Window QA',
      serviceNumber: 'QA-OUT',
      cabinClassCode: 'ECONOMY',
      totalCapacity: 50,
      returnMinDays: 2,
      returnMaxDays: 16,
    };
    const out = await service.publish(
      base,
      actor,
      branchId,
      'window-out-' + userId,
    );
    const reverse = {
      ...base,
      originId: destinationId,
      destinationId: originId,
      returnMinDays: null,
      returnMaxDays: null,
      serviceNumber: 'QA-BACK',
    };
    const good = await service.publish(
      {
        ...reverse,
        departureAt: '2099-10-19T10:00:00Z',
        arrivalAt: '2099-10-19T12:00:00Z',
      },
      actor,
      branchId,
      'window-good-' + userId,
    );
    const bad = await service.publish(
      {
        ...reverse,
        departureAt: '2099-10-20T10:00:00Z',
        arrivalAt: '2099-10-20T12:00:00Z',
      },
      actor,
      branchId,
      'window-bad-' + userId,
    );
    const rows = (await service.managed(actor)).data;
    outbound = rows.find((o) => o.id === out.data.id)!;
    allowed = rows.find((o) => o.id === good.data.id)!;
    excluded = rows.find((o) => o.id === bad.data.id)!;
  }, 60000);
  afterAll(async () => {
    if (client) await client.$disconnect();
  });
  it('persists limits and filters reverse offers at inclusive Max after browser-independent reload', async () => {
    expect(outbound.returnMinDays).toBe(2);
    expect(outbound.returnMaxDays).toBe(16);
    expect(allowed.returnMinDays).toBeNull();
    const result = await service.search(
      {
        originId: destinationId,
        destinationId: originId,
        departureFrom: '2099-10-01',
        outboundOfferId: outbound.id,
      },
      actor,
    );
    expect(result.data.map((o) => o.id)).toEqual([allowed.id]);
    const all = await service.search(
      {
        originId: destinationId,
        destinationId: originId,
        departureFrom: '2099-10-01',
      },
      actor,
    );
    expect(all.data).toHaveLength(2);
  });
  it('prevents partial capacity allocation for a forged out-of-window return, then reserves a valid later-week return', async () => {
    const contractId = randomUUID();
    const invalid = await service.reserve(
      [selection(outbound, 'OUTBOUND'), selection(excluded, 'RETURN')],
      branchId,
      contractId,
      2,
    );
    expect(invalid.available).toBe(false);
    expect(
      await client.ticketOfferCapacityAllocation.count({
        where: { contractId },
      }),
    ).toBe(0);
    const valid = await service.reserve(
      [selection(outbound, 'OUTBOUND'), selection(allowed, 'RETURN')],
      branchId,
      contractId,
      2,
    );
    expect(valid.available).toBe(true);
    expect(
      await client.ticketOfferCapacityAllocation.count({
        where: { contractId },
      }),
    ).toBe(2);
  });
  it('protects a linked offer window and enforces the SQL range constraint', async () => {
    const offer = {
      originId,
      destinationId,
      departureAt: outbound.departureAt,
      arrivalAt: outbound.arrivalAt,
      carrierName: outbound.carrierName,
      serviceNumber: outbound.serviceNumber,
      cabinClassCode: outbound.cabinClassCode,
      totalCapacity: outbound.totalCapacity,
      returnMinDays: 2,
      returnMaxDays: 17,
    };
    await expect(
      service.revise(
        outbound.id,
        { expectedVersion: outbound.version, offer },
        actor,
      ),
    ).rejects.toThrow(/قرارداد/);
    await expect(
      client.ticketPublishedOffer.update({
        where: { id: excluded.id },
        data: { returnMinDays: 17, returnMaxDays: 16 },
      }),
    ).rejects.toThrow();
  });
});
