import 'reflect-metadata';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SalesController } from './sales.controller';
import { SalesProfitService } from './sales-profit.service';
import { SalesService } from './sales.service';
import { SalesOutputService } from './sales-output.service';
import { TravelWorkflowService } from '../reservations/travel-workflow.service';
import { FinanceDeliveryService } from '../finance/document-delivery/finance-delivery.module';
import { IamService } from '../iam/iam.service';
const id = '11111111-1111-4111-8111-111111111111';
let app: INestApplication;
const contract = {
  id,
  branchId: 'branch',
  servicesDetail: [{ clientKey: 'insurance', kind: 'INSURANCE' }],
  priceComponents: [{ type: 'BASE', amount: '100', currencyCode: 'IRR' }],
  passengersDetail: [],
  ticketSelections: [],
  hotelSelection: null,
};
const reservations = { contractPurchaseContext: vi.fn(async () => null) };
const finance = { recordedCostsForOffers: vi.fn(async () => []) };
const sales = {
  detail: vi.fn(async (_id: string, actor: { permissions: string[] }) => {
    if (!actor.permissions.includes('sales.contracts.read.own'))
      throw new ForbiddenException();
    return { data: contract };
  }),
};
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [SalesController],
    providers: [
      {
        provide: SalesProfitService,
        useValue: new SalesProfitService(
          sales as never,
          reservations as never,
          finance as never,
        ),
      },
      { provide: SalesService, useValue: sales },
      { provide: SalesOutputService, useValue: {} },
      { provide: TravelWorkflowService, useValue: {} },
      { provide: FinanceDeliveryService, useValue: {} },
      {
        provide: IamService,
        useValue: {
          authenticate: async (token: string) => ({
            userId: 'actor',
            branchIds: token === 'other-branch' ? ['other'] : ['branch'],
            permissions:
              token === 'no-finance'
                ? ['sales.contracts.read.own']
                : token === 'no-sales'
                  ? ['finance.read']
                  : ['sales.contracts.read.own', 'finance.read'],
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
it('authenticates the profit route and denies missing finance/Sales or other branch before costs are read', async () => {
  await request(app.getHttpServer())
    .get(`/sales/contracts/${id}/profit`)
    .expect(401);
  for (const token of ['no-finance', 'no-sales', 'other-branch'])
    await request(app.getHttpServer())
      .get(`/sales/contracts/${id}/profit`)
      .set('Cookie', `nora_access=${token}`)
      .expect(403);
  expect(reservations.contractPurchaseContext).not.toHaveBeenCalled();
});
it('returns no-store incomplete actual profit for an authorized contract instead of inventing zero insurance cost', async () => {
  const result = await request(app.getHttpServer())
    .get(`/sales/contracts/${id}/profit`)
    .set('Cookie', 'nora_access=allowed')
    .expect(200);
  expect(result.headers['cache-control']).toBe('private, no-store');
  expect(result.body.data).toMatchObject({
    complete: false,
    missingServiceKeys: ['insurance'],
    totals: [
      {
        currencyCode: 'IRR',
        salesAmount: '100',
        purchaseAmount: '0',
        profitAmount: null,
      },
    ],
  });
  expect(reservations.contractPurchaseContext).toHaveBeenCalledWith(
    id,
    'branch',
  );
});
