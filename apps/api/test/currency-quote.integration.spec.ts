import 'reflect-metadata';
import {
  ValidationPipe,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../src/iam/auth.guard';
import { IamService } from '../src/iam/iam.service';
import { CurrencyRateController } from '../src/master-data/currency-rate.controller';
import { CurrencyRateService } from '../src/master-data/currency-rate.service';

describe('currency quote HTTP contract', () => {
  let app: INestApplication;
  let permissions: string[];
  const createQuote = vi.fn();
  const input = {
    fromCurrencyCode: 'usd',
    toCurrencyCode: 'irr',
    buyRate: '1.1234567890',
    sellRate: '2.1234567890',
    source: 'Test quote',
    observedAt: '2026-08-31T12:00:00Z',
  };
  const auth: CanActivate = {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().actor = {
        userId: '11111111-1111-4111-8111-111111111111',
        branchIds: ['33333333-3333-4333-8333-333333333333'],
        permissions,
      };
      return true;
    },
  };
  beforeEach(async () => {
    permissions = ['master_data.create', 'master_data.currency_rate.create'];
    createQuote.mockResolvedValue({ data: [] });
    const module = await Test.createTestingModule({
      controllers: [CurrencyRateController],
      providers: [
        { provide: CurrencyRateService, useValue: { createQuote } },
        {
          provide: IamService,
          useValue: {
            assertPermissions: IamService.prototype.assertPermissions,
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(auth)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    await app?.close();
    vi.clearAllMocks();
  });

  it('accepts both sides through the actual runtime DTO and forwards the authenticated actor', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/master-data/currency-rates/quotes')
      .send(input)
      .expect(201);
    expect(createQuote).toHaveBeenCalledWith(
      expect.objectContaining({
        ...input,
        fromCurrencyCode: 'USD',
        toCurrencyCode: 'IRR',
      }),
      expect.objectContaining({ permissions }),
      undefined,
    );
  });
  it('uses the real permission guard and denies missing rate permission', async () => {
    permissions = ['master_data.create'];
    await request(app.getHttpServer())
      .post('/api/v1/master-data/currency-rates/quotes')
      .send(input)
      .expect(403);
    expect(createQuote).not.toHaveBeenCalled();
  });
  it('rejects forged workflow metadata before invoking the service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/master-data/currency-rates/quotes')
      .send({ ...input, status: 'APPROVED', isAuthoritative: true })
      .expect(400);
    expect(createQuote).not.toHaveBeenCalled();
  });
});
