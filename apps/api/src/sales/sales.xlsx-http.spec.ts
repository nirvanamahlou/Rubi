import { TravelWorkflowService } from '../reservations/travel-workflow.service';
import { FinanceDeliveryService } from '../finance/document-delivery/finance-delivery.module';
import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { SalesOutputService } from './sales-output.service';
import type { SalesRepository } from './sales.repository';
import { IamService } from '../iam/iam.service';
import type {
  SalesCustomersPublicAdapter,
  SalesTicketAvailabilityPort,
} from './sales.adapters';

describe('authenticated Sales XLSX HTTP route', () => {
  let app: INestApplication;
  const list = vi
    .fn()
    .mockResolvedValue({ data: [], page: 1, pageSize: 20, total: 0 });
  beforeAll(async () => {
    const service = new SalesService(
      { list } as unknown as SalesRepository,
      {} as SalesCustomersPublicAdapter,
      {} as SalesTicketAvailabilityPort,
    );
    const module = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [
        { provide: TravelWorkflowService, useValue: {} },
        { provide: FinanceDeliveryService, useValue: {} },
        { provide: SalesService, useValue: service },
        { provide: SalesOutputService, useValue: {} },
        {
          provide: IamService,
          useValue: {
            authenticate: async (token: string) => ({
              userId: 'actor',
              branchIds: ['branch'],
              permissions:
                token === 'allowed'
                  ? [
                      'sales.export',
                      'sales.contracts.read.own',
                      'sales.payments.read',
                    ]
                  : ['sales.contracts.read.own'],
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
  it('returns 401 without session and 403 without export permission', async () => {
    await request(app.getHttpServer())
      .get('/sales/contracts/export.xlsx')
      .expect(401);
    await request(app.getHttpServer())
      .get('/sales/contracts/export.xlsx')
      .set('Cookie', 'rubi_access=denied')
      .expect(403);
    expect(list).not.toHaveBeenCalled();
  });
  it('returns a private real XLSX attachment using the applied filter', async () => {
    const result = await request(app.getHttpServer())
      .get('/sales/contracts/export.xlsx?search=TRACK&settlementStatus=UNPAID')
      .set('Cookie', 'rubi_access=allowed')
      .expect(200);
    expect(result.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(result.headers['content-disposition']).toMatch(
      /attachment; filename="sales-contracts-.*\.xlsx"/,
    );
    expect(result.headers['cache-control']).toBe('private, no-store');
    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ search: 'TRACK', settlementStatus: 'UNPAID' }),
      expect.objectContaining({ branchId: { in: ['branch'] } }),
      true,
      2000,
    );
  });
  it('rejects injected or unsupported filter keys instead of exporting a different scope', async () => {
    await request(app.getHttpServer())
      .get(
        '/sales/contracts/export.xlsx?exportLimit=100000&settlementStatus=bad',
      )
      .set('Cookie', 'rubi_access=allowed')
      .expect(400);
  });
});
