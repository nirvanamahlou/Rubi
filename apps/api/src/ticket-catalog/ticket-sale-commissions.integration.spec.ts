import { randomUUID } from 'node:crypto';
import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { createDatabaseClient } from '@nora/database';
import type { AuthenticatedActor } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import { TicketPublicService } from './ticket-public.service';
import type { ProcurementPublicService } from '../procurement/procurement-public.service';
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)('ticket sale commissions PostgreSQL', () => {
  let client: ReturnType<typeof createDatabaseClient>;

  let service: TicketPublicService;
  const branchId = randomUUID(),
    otherBranchId = randomUUID(),
    userId = randomUUID(),
    offerId = randomUUID(),
    returnId = randomUUID(),
    secondId = randomUUID(),
    unpricedId = randomUUID(),
    externalId = randomUUID(),
    targetId = randomUUID(),
    otherTargetId = randomUUID();
  const actor = {
    userId,
    branchIds: [branchId],
    permissions: ['ticket_catalog.manage', 'ticket_catalog.read'],
  } as AuthenticatedActor;
  const input = {
    offerId,
    salePriceTargetId: targetId,
    percent: '4',
    expectedRevision: 0,
    expectedBaseRevision: 1,
    copyToAll: true,
  };
  beforeAll(async () => {
    if (
      !url ||
      !new URL(url).pathname.startsWith('/rubi_ticket_commission_0928_')
    )
      throw new Error('Isolated rehearsal DB required');
    client = createDatabaseClient(url);
    service = new TicketPublicService(
      { client } as DatabaseService,
      {} as ProcurementPublicService,
    );
    await client.user.create({
      data: {
        id: userId,
        username: 'qa-' + userId,
        displayName: 'Synthetic QA',
        passwordHash: 'INVALID-SYNTHETIC-NO-LOGIN',
      },
    });
    for (const id of [branchId, otherBranchId])
      await client.branch.create({
        data: { id, code: 'QA-' + id.slice(0, 8), name: 'Synthetic QA branch' },
      });
    for (const [id, branch] of [
      [targetId, branchId],
      [otherTargetId, branchId],
    ])
      await client.ticketSalePriceTarget.create({
        data: {
          id: id!,
          branchId: branch!,
          name: 'Synthetic partner',
          code: 'QA-' + id!.slice(0, 8),
          createdByUserId: userId,
        },
      });
    for (const [id, branch] of [
      [offerId, branchId],
      [returnId, branchId],
      [secondId, branchId],
      [unpricedId, branchId],
      [externalId, otherBranchId],
    ])
      await client.ticketPublishedOffer.create({
        data: {
          id: id!,
          branchId: branch!,
          originId: randomUUID(),
          destinationId: randomUUID(),
          departureAt: new Date('2099-01-01T10:00:00Z'),
          arrivalAt: new Date('2099-01-01T14:00:00Z'),
          carrierName: 'Synthetic QA',
          serviceNumber: 'QA-' + id!.slice(0, 6),
          cabinClassCode: 'ECONOMY',
          totalCapacity: 50,
          createdByUserId: userId,
          createKey: randomUUID(),
          fingerprint: 'synthetic',
        },
      });
    for (const [id, amount] of [
      [offerId, '100'],
      [secondId, '200'],
      [externalId, '300'],
    ])
      await client.ticketOfferStandaloneSalePrice.create({
        data: {
          offerId: id!,
          revision: 1,
          amount: amount!,
          currencyCode: 'IRR',
          actorUserId: userId,
          commandKey: randomUUID(),
          fingerprint: 'synthetic',
        },
      });
    await client.ticketOfferRoundTripSalePrice.create({
      data: {
        outboundOfferId: offerId,
        returnOfferId: returnId,
        revision: 1,
        amount: '250',
        currencyCode: 'IRR',
        actorUserId: userId,
        commandKey: randomUUID(),
        fingerprint: 'synthetic',
      },
    });
  }, 180000);
  afterAll(async () => {
    if (client) await client.$disconnect();
  }, 60000);
  it('persists and reopens partner percentages for both single and pair fares, excluding unpriced and other branches', async () => {
    expect(
      await service.updateSaleCommission(input, actor, 'qa-copy-' + userId),
    ).toEqual({ data: { count: 3, revision: 1 } });
    const rules = await client.ticketSaleCommissionRevision.findMany({
      where: { commandKey: 'qa-copy-' + userId },
    });
    expect(rules.map((r) => r.offerId)).not.toContain(unpricedId);
    expect(rules.map((r) => r.offerId)).not.toContain(externalId);
    expect(
      rules.every(
        (r) => r.salePriceTargetId === targetId && r.percent.toString() === '4',
      ),
    ).toBe(true);
    const result = await service.managed(actor);
    const source = result.data.find((o) => o.id === offerId)!;
    expect(source.saleCommissions?.find((c) => !c.returnOfferId)?.amount).toBe(
      '96',
    );
    expect(
      source.saleCommissions?.find((c) => c.returnOfferId === returnId)?.amount,
    ).toBe('240');
    expect(
      source.targetedStandaloneSalePrices?.find(
        (p) => p.salePriceTarget.id === targetId,
      )?.amount,
    ).toBe('96');
    expect(
      await service.updateSaleCommission(input, actor, 'qa-copy-' + userId),
    ).toEqual({ data: { count: 3, revision: 1 } });
    await expect(
      service.updateSaleCommission(
        { ...input, percent: '3' },
        actor,
        'qa-copy-' + userId,
      ),
    ).rejects.toThrow('اطلاعات متفاوت');
  }, 60000);
  it('rolls back the entire bulk operation if a later row cannot be written', async () => {
    const faulty = {
      $transaction: (
        operation: (tx: unknown) => Promise<unknown>,
        options: unknown,
      ) =>
        client.$transaction(async (tx) => {
          let count = 0;
          const proxy = new Proxy(tx, {
            get(t, key) {
              if (key === 'ticketSaleCommissionRevision')
                return {
                  ...t.ticketSaleCommissionRevision,
                  create: async (
                    args: Parameters<
                      typeof t.ticketSaleCommissionRevision.create
                    >[0],
                  ) => {
                    if (++count === 2)
                      throw new Error('synthetic write failure');
                    return t.ticketSaleCommissionRevision.create(args);
                  },
                };
              return Reflect.get(t, key);
            },
          });
          return operation(proxy);
        }, options as never),
    };
    const faultyService = new TicketPublicService(
      { client: faulty } as unknown as DatabaseService,
      {} as ProcurementPublicService,
    );
    await expect(
      faultyService.updateSaleCommission(
        { ...input, expectedRevision: 1, percent: '5' },
        actor,
        'qa-rollback-' + userId,
      ),
    ).rejects.toThrow('synthetic write failure');
    expect(
      await client.ticketSaleCommissionRevision.count({
        where: { commandKey: 'qa-rollback-' + userId },
      }),
    ).toBe(0);
  }, 60000);
  it('rejects stale copies, cross-branch writes and concurrent stale overwrites', async () => {
    await expect(
      service.updateSaleCommission(input, actor, 'qa-stale-' + userId),
    ).rejects.toThrow('تغییر کرده');
    await expect(
      service.updateSaleCommission(
        { ...input, offerId: externalId },
        actor,
        'qa-cross-' + userId,
      ),
    ).rejects.toThrow('شعبه');
    const attempts = await Promise.allSettled(
      ['6', '7'].map((percent) =>
        service.updateSaleCommission(
          { ...input, percent, expectedRevision: 1, copyToAll: false },
          actor,
          'qa-concurrent-' + userId + percent,
        ),
      ),
    );
    expect(attempts.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter((r) => r.status === 'rejected')).toHaveLength(1);
  }, 60000);
  it('keeps other destinations independent, recomputes after base repricing, and protects revision history', async () => {
    await service.updateSaleCommission(
      {
        ...input,
        salePriceTargetId: otherTargetId,
        percent: '3',
        copyToAll: false,
      },
      actor,
      'qa-other-target-' + userId,
    );
    await service.updateStandaloneSalePrice(
      offerId,
      { expectedRevision: 1, amount: '200', currencyCode: 'IRR' },
      actor,
      'qa-new-base-' + userId,
    );
    const source = (await service.managed(actor)).data.find(
      (o) => o.id === offerId,
    )!;
    expect(source.baseStandaloneSalePrice?.amount).toBe('200');
    expect(
      source.targetedStandaloneSalePrices?.find(
        (p) => p.salePriceTarget.id === otherTargetId,
      )?.amount,
    ).toBe('194');
    const rule = await client.ticketSaleCommissionRevision.findFirstOrThrow({
      where: { offerId, salePriceTargetId: otherTargetId },
    });
    await expect(
      client.ticketSaleCommissionRevision.update({
        where: { id: rule.id },
        data: { percent: '9' },
      }),
    ).rejects.toThrow();
    await expect(
      client.ticketSaleCommissionRevision.delete({ where: { id: rule.id } }),
    ).rejects.toThrow();
    await expect(
      client.ticketSaleCommissionRevision.create({
        data: {
          offerId: randomUUID(),
          scopeKey: randomUUID(),
          revision: 1,
          percent: '1',
          actorUserId: userId,
          commandKey: randomUUID(),
          fingerprint: 'synthetic',
        },
      }),
    ).rejects.toThrow();
  }, 60000);
});
