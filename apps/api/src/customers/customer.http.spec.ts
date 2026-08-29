import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import { PermissionGuard } from '../iam/permission.guard';
import { CustomerService } from './customer.service';
import { CustomersController } from './customers.controller';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  permissions: ['customers.read', 'customers.create'],
  branchIds: ['33333333-3333-4333-8333-333333333333'],
};
describe('Customers HTTP integration', () => {
  let app: INestApplication;
  const service = {
    list: vi.fn().mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 25, total: 0 },
    }),
    create: vi.fn().mockResolvedValue({ data: { id: 'customer-id' } }),
    detail: vi.fn().mockResolvedValue({ data: { id: 'customer-id' } }),
    addConsent: vi.fn().mockResolvedValue({ data: { id: 'customer-id' } }),
  };
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [CustomersController],
      providers: [
        { provide: CustomerService, useValue: service },
        AuthGuard,
        PermissionGuard,
        {
          provide: IamService,
          useValue: {
            authenticate: vi.fn().mockResolvedValue(actor),
            assertPermissions: vi.fn(),
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  afterEach(async () => {
    if (app) await app.close();
    vi.clearAllMocks();
  });

  it('serves the versioned list route with actor context', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/customers')
      .set('Cookie', 'rubi_access=test')
      .expect(200)
      .expect({ data: [], meta: { page: 1, pageSize: 25, total: 0 } });
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
      actor,
    );
  });

  it('forwards an explicit sensitive-read reason without logging contact data', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/customers/44444444-4444-4444-8444-444444444444')
      .set('Cookie', 'rubi_access=test')
      .set('x-sensitive-read-reason', 'customer-verification')
      .expect(200);
    expect(service.detail).toHaveBeenCalledWith(
      '44444444-4444-4444-8444-444444444444',
      actor,
      undefined,
      'customer-verification',
    );
  });

  it('rejects invalid mutation payloads before application service', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/customers')
      .set('Cookie', 'rubi_access=test')
      .send({ kind: 'person', displayName: '', roles: [] })
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });

  it('trims and forwards the actual consent reason', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/customers/44444444-4444-4444-8444-444444444444/consents')
      .set('Cookie', 'rubi_access=test')
      .send({
        purpose: 'marketing',
        channel: 'all',
        status: 'granted',
        source: 'staff-ui',
        reason: '  درخواست حضوری مشتری  ',
        version: 1,
      })
      .expect(201);

    expect(service.addConsent).toHaveBeenCalledWith(
      '44444444-4444-4444-8444-444444444444',
      expect.objectContaining({ reason: 'درخواست حضوری مشتری' }),
      actor,
      undefined,
      undefined,
    );
  });

  it.each(['', ' ', '\t', '\n', 'x'.repeat(501)])(
    'rejects invalid consent reason at the HTTP boundary (%j)',
    async (reason) => {
      await request(app.getHttpServer())
        .post('/api/v1/customers/44444444-4444-4444-8444-444444444444/consents')
        .set('Cookie', 'rubi_access=test')
        .send({
          purpose: 'marketing',
          channel: 'all',
          status: 'granted',
          source: 'staff-ui',
          reason,
          version: 1,
        })
        .expect(400);

      expect(service.addConsent).not.toHaveBeenCalled();
    },
  );
});
