import { Test } from '@nestjs/testing';
import type { INestApplication, ExecutionContext } from '@nestjs/common';
import request from 'supertest';
import { AuthGuard } from '../iam/auth.guard';
import { TicketRuntimeModule } from './ticket-runtime.module';
import { TourPublicService } from './tour-public.service';
import { randomUUID } from 'node:crypto';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDatabaseClient } from '@nora/database';
import type { AuthenticatedActor, TicketOfferCreateV1 } from '@nora/contracts';
import type { DatabaseService } from '../database/database.service';
import { ProcurementPublicService } from '../procurement/procurement-public.service';
import { TicketPublicService } from './ticket-public.service';
const url = process.env.TICKET_MANAGEMENT_TEST_DATABASE_URL;
describe.skipIf(!url)('ticket management PostgreSQL lifecycle', () => {
  let client: ReturnType<typeof createDatabaseClient>;
  let app: INestApplication;
  let service: TicketPublicService;
  let purchases: ProcurementPublicService;
  const branchId = randomUUID(),
    userId = randomUUID();
  const actor = {
    userId,
    branchIds: [branchId],
    permissions: ['ticket_catalog.manage', 'ticket_catalog.read'],
  } as AuthenticatedActor;
  const definition: TicketOfferCreateV1 = {
    originId: randomUUID(),
    destinationId: randomUUID(),
    departureAt: '2099-10-01T10:00:30.000Z',
    arrivalAt: '2099-10-01T12:00:30.000Z',
    carrierName: 'Synthetic QA',
    serviceNumber: 'QA-4512',
    cabinClassCode: 'ECONOMY',
    totalCapacity: 50,
  };
  beforeAll(async () => {
    if (
      !url ||
      !['localhost', '127.0.0.1'].includes(new URL(url).hostname) ||
      !new URL(url).pathname.startsWith('/rubi_ticket_commission_0928_')
    )
      throw Error('Isolated synthetic database required');
    client = createDatabaseClient(url);
    await client.user.create({
      data: {
        id: userId,
        username: 'qa-management-' + userId,
        displayName: 'Synthetic QA',
        passwordHash: 'INVALID-NO-LOGIN',
      },
    });
    await client.branch.create({
      data: {
        id: branchId,
        code: 'QA-' + branchId,
        name: 'Synthetic Ticket QA',
      },
    });
    const database = { client } as DatabaseService;
    purchases = new ProcurementPublicService(database);
    service = new TicketPublicService(database, purchases);
    const module = await Test.createTestingModule({
      controllers: Reflect.getMetadata('controllers', TicketRuntimeModule),
      providers: [
        { provide: TicketPublicService, useValue: service },
        { provide: TourPublicService, useValue: {} },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const req = context.switchToHttp().getRequest();
          req.actor = req.headers['x-qa-no-access']
            ? { ...actor, permissions: [] }
            : actor;
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  }, 60000);
  afterAll(async () => {
    if (app) await app.close();
    if (client) await client.$disconnect();
  }, 60000);
  it('creates ten identical-schedule independent offers, edits, pauses, activates, holds and archives safely', async () => {
    const ids: string[] = [];
    for (let index = 0; index < 10; index++) {
      const key = 'ticket-catalog:qa-' + userId + '-' + index;
      const first = await service.publish(definition, actor, branchId, key);
      expect(await service.publish(definition, actor, branchId, key)).toEqual(
        first,
      );
      ids.push(first.data.id);
    }
    const list = (await service.managed(actor)).data;
    expect(list).toHaveLength(10);
    expect(new Set(list.map((o) => o.id)).size).toBe(10);
    expect(
      list.every((o) => o.catalogProductId?.startsWith('qa-' + userId)),
    ).toBe(true);
    const id = ids[0]!;
    await expect(
      service.publish(
        { ...definition, totalCapacity: 60 },
        actor,
        branchId,
        'ticket-catalog:qa-' + userId + '-0',
      ),
    ).rejects.toThrow('اطلاعات متفاوت');
    await expect(
      service.revise(
        id,
        { expectedVersion: 1, offer: definition },
        { ...actor, branchIds: [randomUUID()] },
      ),
    ).rejects.toThrow('شعبه');
    await service.revise(
      id,
      {
        expectedVersion: 1,
        offer: { ...definition, totalCapacity: 60, serviceNumber: 'QA-EDIT' },
      },
      actor,
    );
    await expect(
      service.revise(id, { expectedVersion: 1, offer: definition }, actor),
    ).rejects.toThrow('تغییر کرده');
    await service.updateStatus(
      id,
      { expectedVersion: 2, status: 'PAUSED' },
      actor,
    );
    expect(
      (await service.managed(actor)).data.find((o) => o.id === id)?.status,
    ).toBe('PAUSED');
    await service.updateStatus(
      id,
      { expectedVersion: 3, status: 'ACTIVE' },
      actor,
    );
    const holdInput = {
      quantity: 2,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    };
    const hold = await service.holdTemporary(
      id,
      holdInput,
      actor,
      branchId,
      'hold-' + userId,
    );
    expect(
      await service.holdTemporary(
        id,
        holdInput,
        actor,
        branchId,
        'hold-' + userId,
      ),
    ).toEqual(hold);
    expect(
      (await service.managed(actor)).data.find((o) => o.id === id)
        ?.remainingCapacity,
    ).toBe(58);
    await expect(service.archiveExpired(id, 4, actor)).rejects.toThrow(
      'رزرو ظرفیت',
    );
    await expect(
      service.revise(
        id,
        { expectedVersion: 4, offer: { ...definition, totalCapacity: 60 } },
        actor,
      ),
    ).rejects.toThrow('رزرو ظرفیت');
    await client.ticketOfferCapacityHold.update({
      where: { id: hold.data.id },
      data: { status: 'RELEASED' },
    });
    await service.updateStandaloneSalePrice(
      id,
      { expectedRevision: 0, amount: '10000000', currencyCode: 'IRR' },
      actor,
      'price-' + userId,
    );
    await service.updateSaleCommission(
      {
        offerId: id,
        returnOfferId: null,
        salePriceTargetId: null,
        expectedRevision: 0,
        expectedBaseRevision: 1,
        percent: '4',
      },
      actor,
      'commission-' + userId,
    );
    expect(
      (await service.managed(actor)).data.find((o) => o.id === id)
        ?.standaloneSalePrice?.amount,
    ).toBe('9600000');
    await service.archiveExpired(id, 4, actor);
    expect((await service.managed(actor)).data).toHaveLength(9);
    expect(
      await client.ticketOfferStandaloneSalePrice.count({
        where: { offerId: id },
      }),
    ).toBe(1);
    expect(
      await client.ticketSaleCommissionRevision.count({
        where: { offerId: id },
      }),
    ).toBe(1);
    expect(
      (await purchases.listFinanceTicketPurchases([branchId])).length,
    ).toBe(10);
    await expect(
      service.revise(id, { expectedVersion: 5, offer: definition }, actor),
    ).rejects.toThrow('شعبه');
    await expect(
      service.updateStatus(id, { expectedVersion: 5, status: 'ACTIVE' }, actor),
    ).rejects.toThrow('شعبه');
  }, 120000);
  it('runs the actual HTTP create/edit/status/delete routes and rejects unauthorized and stale writes', async () => {
    const api = request(app.getHttpServer());
    const endpoint = '/api/v1/ticket-catalog/offers';
    const before = await api.get(endpoint + '/management').expect(200);
    const result = await api
      .post(endpoint)
      .set('x-branch-id', branchId)
      .set('idempotency-key', 'http-' + userId)
      .send(definition)
      .expect(201);
    const id = result.body.data.id;
    expect(
      (await api.get(endpoint + '/management').expect(200)).body.data,
    ).toHaveLength(before.body.data.length + 1);
    await api
      .patch(endpoint + '/' + id)
      .set('x-qa-no-access', '1')
      .send({ expectedVersion: 1, offer: definition })
      .expect(403);
    await api
      .patch(endpoint + '/' + id)
      .send({
        expectedVersion: 1,
        offer: { ...definition, serviceNumber: 'HTTP-EDIT' },
      })
      .expect(200);
    await api
      .patch(endpoint + '/' + id)
      .send({ expectedVersion: 1, offer: definition })
      .expect(409);
    await api
      .patch(endpoint + '/' + id + '/status')
      .send({ expectedVersion: 2, status: 'PAUSED' })
      .expect(200);
    await api
      .patch(endpoint + '/' + id + '/status')
      .send({ expectedVersion: 3, status: 'ACTIVE' })
      .expect(200);
    await api
      .delete(endpoint + '/' + id)
      .send({ expectedVersion: 4 })
      .expect(200);
    expect(
      (await api.get(endpoint + '/management').expect(200)).body.data,
    ).toHaveLength(before.body.data.length);
  }, 60000);
});
