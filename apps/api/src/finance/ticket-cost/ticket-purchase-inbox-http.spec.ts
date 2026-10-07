import 'reflect-metadata';
import { afterAll, beforeAll, it, expect, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  FinanceTicketCostController,
  TicketPurchaseInboxController,
} from '../finance-ticket-cost.module';
import { FinanceTicketCostService } from './finance-ticket-cost.service';
import { IamService } from '../../iam/iam.service';
let app: INestApplication;
const costs = {
  purchaseInbox: vi.fn(async () => ({ data: [], meta: { canPrice: true } })),
  recordCost: vi.fn(async () => ({ id: 'cost' })),
  recordPayment: vi.fn(),
};
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [TicketPurchaseInboxController, FinanceTicketCostController],
    providers: [
      { provide: FinanceTicketCostService, useValue: costs },
      {
        provide: IamService,
        useValue: {
          assertPermissions: (
            actor: { permissions: string[] },
            required: string[],
          ) => {
            if (required.some((code) => !actor.permissions.includes(code)))
              throw new ForbiddenException();
          },
          authenticate: async (token: string) => ({
            userId: 'actor',
            branchIds: ['branch'],
            permissions:
              token === 'buyer'
                ? ['procurement.quote.manage']
                : ['finance.payment.create'],
          }),
        },
      },
    ],
  }).compile();
  app = module.createNestApplication();
  await app.init();
});
afterAll(async () => {
  await app?.close();
});
it('authenticates and guards purchase pricing and closes the old Finance pricing route', async () => {
  const path =
    '/procurement/ticket-purchases/11111111-1111-4111-8111-111111111111/costs';
  await request(app.getHttpServer()).post(path).send({}).expect(401);
  await request(app.getHttpServer())
    .post(path)
    .set('Cookie', 'nora_access=finance')
    .send({})
    .expect(403);
  await request(app.getHttpServer())
    .post(
      '/finance/ticket-purchases/11111111-1111-4111-8111-111111111111/costs',
    )
    .set('Cookie', 'nora_access=finance')
    .send({})
    .expect(403);
  expect(costs.recordCost).not.toHaveBeenCalled();
  await request(app.getHttpServer())
    .post(path)
    .set('Cookie', 'nora_access=buyer')
    .send({
      version: 1,
      operationId: '22222222-2222-4222-8222-222222222222',
      expectedCostVersion: 0,
      seatCount: 20,
      unitCost: '100',
      currencyCode: 'IRR',
    })
    .expect(201);
  expect(costs.recordCost).toHaveBeenCalledTimes(1);
});
it('serves the purchase inbox privately without caching', async () => {
  const result = await request(app.getHttpServer())
    .get('/procurement/ticket-purchases/inbox')
    .set('Cookie', 'nora_access=buyer')
    .expect(200);
  expect(result.headers['cache-control']).toBe('private, no-store');
});
