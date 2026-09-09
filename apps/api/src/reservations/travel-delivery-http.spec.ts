import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { SalesController } from '../sales/sales.controller';
import { SalesService } from '../sales/sales.service';
import { SalesOutputService } from '../sales/sales-output.service';
import { TravelWorkflowService } from './travel-workflow.service';
import { FinanceDeliveryService } from '../finance/document-delivery/finance-delivery.module';
import { IamService } from '../iam/iam.service';
const id = '11111111-1111-4111-8111-111111111111';
describe('finance gate on passenger documents', () => {
  let app: INestApplication;
  const detail = vi.fn();
  const forContract = vi.fn();
  const read = vi.fn();
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [
        { provide: SalesService, useValue: { detail } },
        { provide: SalesOutputService, useValue: {} },
        { provide: TravelWorkflowService, useValue: { forContract } },
        { provide: FinanceDeliveryService, useValue: { read } },
        {
          provide: IamService,
          useValue: {
            authenticate: async () => ({
              userId: 'actor',
              branchIds: ['allowed-branch'],
              permissions: ['sales.contracts.read.own'],
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
  const get = () =>
    request(app.getHttpServer())
      .get(`/sales/contracts/${id}/travel-documents`)
      .set('Cookie', 'rubi_access=allowed');
  it('rejects unauthenticated access before loading a snapshot', async () => {
    await request(app.getHttpServer())
      .get(`/sales/contracts/${id}/travel-documents`)
      .expect(401);
    expect(forContract).not.toHaveBeenCalled();
  });
  it('checks Sales ownership before requesting reservations data', async () => {
    detail.mockRejectedValueOnce(new ForbiddenException());
    await get().expect(403);
    expect(forContract).not.toHaveBeenCalled();
  });
  it('does not return passenger content while Finance is blocked or revoked', async () => {
    detail.mockResolvedValue({});
    forContract.mockResolvedValue({
      id,
      snapshot: { secret: 'passenger data' },
      workflow: { supplierStatus: 'CONFIRMED' },
    });
    read.mockResolvedValue({ approved: false, version: 2 });
    const response = await get().expect(403);
    expect(JSON.stringify(response.body)).not.toContain('passenger data');
    expect(forContract).toHaveBeenCalledWith(id, ['allowed-branch']);
  });
  it('blocks cancelled requests even after financial approval', async () => {
    read.mockResolvedValue({ approved: true });
    forContract.mockResolvedValue({
      id,
      workflow: { supplierStatus: 'CANCELLED' },
    });
    await get().expect(403);
  });
  it('returns private output only when both scope and financial authorization allow it', async () => {
    forContract.mockResolvedValue({
      id,
      workflow: { supplierStatus: 'CONFIRMED', voucherIssued: true },
    });
    const response = await get().expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body.data.id).toBe(id);
  });
});
