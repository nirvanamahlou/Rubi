import 'reflect-metadata';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { CurrencyRateController } from './currency-rate.controller';
import { CurrencyRateService } from './currency-rate.service';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';

describe('dedicated currency commands over HTTP', () => {
  let app: INestApplication;
  const id = '44444444-4444-4444-8444-444444444444';
  const mutate = vi
    .fn()
    .mockResolvedValue({ data: { id, version: 2, isActive: true } });
  const genericUpdate = vi.fn();
  const actor = {
    userId: 'test-actor',
    permissions: [
      'master_data.update',
      'master_data.delete',
      'master_data.currency_rate.create',
    ],
    branchIds: ['test-branch'],
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      // Same specific-before-generic registration order as MasterDataModule.
      controllers: [CurrencyRateController, MasterDataController],
      providers: [
        { provide: CurrencyRateService, useValue: { mutate } },
        {
          provide: MasterDataService,
          useValue: { update: genericUpdate, remove: genericUpdate },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { actor: unknown } };
        }) => {
          context.switchToHttp().getRequest().actor = actor;
          return true;
        },
      })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('routes PATCH to the dedicated controller with exact amount/version and branch', async () => {
    await request(app.getHttpServer())
      .patch(`/master-data/currency-rates/${id}`)
      .set('x-branch-id', 'test-branch')
      .send({ expectedVersion: 1, rate: '270000.1234567890' })
      .expect(200);
    expect(mutate).toHaveBeenLastCalledWith(
      id,
      expect.objectContaining({
        expectedVersion: 1,
        rate: '270000.1234567890',
      }),
      'update',
      actor,
      'test-branch',
    );
    expect(genericUpdate).not.toHaveBeenCalled();
  });
  it('routes DELETE with a versioned body, not generic permanent deletion', async () => {
    await request(app.getHttpServer())
      .delete(`/master-data/currency-rates/${id}`)
      .send({ expectedVersion: 2 })
      .expect(200);
    expect(mutate).toHaveBeenLastCalledWith(
      id,
      expect.objectContaining({ expectedVersion: 2 }),
      'delete',
      actor,
      undefined,
    );
    expect(genericUpdate).not.toHaveBeenCalled();
  });
  it('rejects malformed decimals, missing versions and forged status before calling the service', async () => {
    const calls = mutate.mock.calls.length;
    for (const body of [
      { rate: '100' },
      { expectedVersion: 1, rate: '1e5' },
      { expectedVersion: 1, rate: '100', status: 'APPROVED' },
    ])
      await request(app.getHttpServer())
        .patch(`/master-data/currency-rates/${id}`)
        .send(body)
        .expect(400);
    await request(app.getHttpServer())
      .delete(`/master-data/currency-rates/${id}`)
      .send({ expectedVersion: 1, isActive: false })
      .expect(400);
    expect(mutate).toHaveBeenCalledTimes(calls);
  });
});
