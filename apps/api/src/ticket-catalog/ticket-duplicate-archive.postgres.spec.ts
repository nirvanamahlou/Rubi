import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { createDatabaseClient } from '@nora/database';
import { TicketPublicService } from './ticket-public.service';

const url = process.env.TICKET_DUPLICATE_TEST_DATABASE_URL;
describe.skipIf(!url)('duplicate flight PostgreSQL proof', () => {
  if (
    url &&
    (!['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
      !new URL(url).pathname.startsWith('/rubi_ticket_duplicates_1006_'))
  )
    throw new Error('Isolated synthetic database required');
  const client = createDatabaseClient(
    url ?? 'postgresql://unused:unused@localhost/unused',
  );
  afterAll(async () => {
    await client.$disconnect();
  });
  const branchId = randomUUID();
  const actor = {
    userId: randomUUID(),
    branchIds: [branchId],
    permissions: ['ticket_catalog.manage'],
  } as never;
  const definition = {
    originId: randomUUID(),
    destinationId: randomUUID(),
    departureAt: '2099-01-01T10:00:00Z',
    arrivalAt: '2099-01-01T12:00:00Z',
    carrierName: 'Synthetic duplicate QA',
    serviceNumber: 'QA-1',
    cabinClassCode: 'ECONOMY' as const,
    totalCapacity: 20,
  };
  const service = new TicketPublicService(
    { client } as never,
    { ensureOfferPurchaseRequest: async () => undefined } as never,
  );
  it('serializes concurrent distinct keys and preserves same-key retries, cabin/date distinctions and edit protection', async () => {
    const outcomes = await Promise.allSettled([
      service.publish(definition, actor, branchId, randomUUID()),
      service.publish(definition, actor, branchId, randomUUID()),
    ]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(
      await client.ticketPublishedOffer.count({ where: { branchId } }),
    ).toBe(1);
    const key = randomUUID();
    const business = { ...definition, cabinClassCode: 'BUSINESS' as const };
    const replay = await Promise.all([
      service.publish(business, actor, branchId, key),
      service.publish(business, actor, branchId, key),
    ]);
    expect(replay[0]).toEqual(replay[1]);
    await expect(
      service.publish(
        {
          ...definition,
          departureAt: '2099-01-02T10:00:00Z',
          arrivalAt: '2099-01-02T12:00:00Z',
        },
        actor,
        branchId,
        randomUUID(),
      ),
    ).resolves.toHaveProperty('data.id');
    expect(
      await client.ticketOfferAudit.count({
        where: { offerId: replay[0]!.data.id },
      }),
    ).toBe(1);
    const other = await service.publish(
      { ...definition, serviceNumber: 'QA-2' },
      actor,
      branchId,
      randomUUID(),
    );
    await expect(
      service.revise(
        other.data.id,
        { expectedVersion: 1, offer: definition },
        actor,
      ),
    ).rejects.toThrow('قبلاً ثبت');
  });
  it('archives only unused exact copies, preserves referenced/priced stock and all IDs, and is idempotent', async () => {
    const batchBranch = randomUUID();
    const insert = (patch: object = {}) =>
      client.ticketPublishedOffer.create({
        data: {
          ...definition,
          departureAt: new Date(definition.departureAt),
          arrivalAt: new Date(definition.arrivalAt),
          branchId: batchBranch,
          createdByUserId: randomUUID(),
          createKey: randomUUID(),
          fingerprint: 'synthetic',
          ...patch,
        },
      });
    const original = await insert();
    const duplicate = await insert();
    const linked = await insert();
    const priced = await insert();
    const priceActor = randomUUID();
    await client.user.create({
      data: {
        id: priceActor,
        username: `duplicate-qa-${priceActor}`,
        displayName: 'Synthetic QA',
        passwordHash: 'INVALID-NO-LOGIN',
      },
    });
    await client.ticketOfferStandaloneSalePrice.create({
      data: {
        offerId: priced.id,
        revision: 1,
        amount: '123.4501',
        currencyCode: 'IRR',
        actorUserId: priceActor,
        commandKey: randomUUID(),
        fingerprint: 'synthetic',
      },
    });
    await client.ticketOfferCapacityAllocation.create({
      data: {
        offerId: linked.id,
        contractId: randomUUID(),
        direction: 'OUTBOUND',
        quantity: 1,
      },
    });
    const differentCabin = await insert({ cabinClassCode: 'BUSINESS' });
    const differentCapacity = await insert({ totalCapacity: 30 });
    const sql = readFileSync(
      resolve(
        __dirname,
        '../../../../packages/database/prisma/migrations/20261006100000_ticket_unused_duplicate_archive/migration.sql',
      ),
      'utf8',
    );
    // execute each statement through one pinned interactive transaction; strip
    // migration BEGIN/COMMIT because Prisma already owns this transaction.
    const repair = () =>
      client.$transaction(async (tx) => {
        for (const statement of sql
          .replace(/^BEGIN;|^COMMIT;/gm, '')
          .split(';')
          .map((s) => s.trim())
          .filter(Boolean))
          await tx.$executeRawUnsafe(statement);
      });
    await repair();
    const rows = await client.ticketPublishedOffer.findMany({
      where: { branchId: batchBranch },
      include: { audit: true },
    });
    expect(rows).toHaveLength(6);
    for (const id of [original.id, duplicate.id, priced.id])
      expect(
        rows
          .find((r) => r.id === id)
          ?.audit.some((a) => a.action === 'ticket.offer.archived'),
      ).toBe(true);
    for (const id of [linked.id, differentCabin.id, differentCapacity.id])
      expect(rows.find((r) => r.id === id)?.audit).toHaveLength(0);
    const count = await client.ticketOfferAudit.count({
      where: { action: 'ticket.offer.duplicate_archived' },
    });
    expect(
      (
        await client.ticketOfferStandaloneSalePrice.findFirst({
          where: { offerId: priced.id },
        })
      )?.amount.toString(),
    ).toBe('123.4501');
    await repair();
    expect(
      await client.ticketOfferAudit.count({
        where: { action: 'ticket.offer.duplicate_archived' },
      }),
    ).toBe(count);
  });
});
