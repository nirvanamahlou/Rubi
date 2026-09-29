import 'reflect-metadata';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../iam/auth.guard';
import { PermissionGuard } from '../iam/permission.guard';
import { CustomerAffairsController } from './customer-affairs.controller';
import { CustomerAffairsService } from './customer-affairs.service';

const actor = {
  userId: '11111111-1111-4111-8111-111111111111',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: [],
};

const lead = {
  title: 'درخواست سفر خانوادگی',
  sourceReference: 'manual:http-test-1',
  inboundChannel: 'PHONE',
  contactOccurredAt: '2026-09-28T08:00:00.000Z',
  travelNeed: 'پرواز و هتل برای دو نفر',
  passengerCount: 2,
  priority: 'NORMAL',
  queueCode: 'customer-affairs-front-office',
  nextAction: 'تماس برای تکمیل اطلاعات',
  nextActionAt: '2026-09-29T08:00:00.000Z',
};

const ticket = {
  subject: 'پیگیری تغییر تاریخ سفر',
  description: 'مشتری خواستار بررسی تاریخ جدید است.',
  channel: 'PHONE',
  contactOccurredAt: '2026-09-28T08:00:00.000Z',
  category: 'DATE_CHANGE',
  impact: 'LOW',
  urgency: 'NORMAL',
  priority: 'NORMAL',
  nextAction: 'استعلام وضعیت از رزرواسیون',
  nextActionAt: '2026-09-29T08:00:00.000Z',
};

describe('customer affairs create HTTP contract', () => {
  let app: INestApplication;
  const service = {
    createLead: vi.fn().mockResolvedValue({ data: { id: 'lead-1' } }),
    createTicket: vi.fn().mockResolvedValue({ data: { id: 'ticket-1' } }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [CustomerAffairsController],
      providers: [{ provide: CustomerAffairsService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { actor: typeof actor } };
        }) => {
          context.switchToHttp().getRequest().actor = actor;
          return true;
        },
      })
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();
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
    await app?.close();
  });

  it('accepts the travel request form and forwards its idempotency key', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/customer-affairs/leads')
      .set('idempotency-key', 'lead-http-key')
      .send(lead)
      .expect(201);
    expect(service.createLead).toHaveBeenCalledWith(
      expect.objectContaining({ sourceReference: lead.sourceReference }),
      actor,
      undefined,
      'lead-http-key',
      undefined,
    );
  });

  it('rejects an invalid travel request before the service call', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/customer-affairs/leads')
      .send({ ...lead, passengerCount: 0 })
      .expect(400);
    expect(service.createLead).not.toHaveBeenCalled();
  });

  it('accepts the support ticket form and forwards its idempotency key', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/customer-affairs/tickets')
      .set('idempotency-key', 'ticket-http-key')
      .send(ticket)
      .expect(201);
    expect(service.createTicket).toHaveBeenCalledWith(
      expect.objectContaining({ subject: ticket.subject }),
      actor,
      undefined,
      'ticket-http-key',
      undefined,
    );
  });

  it('rejects an invalid support ticket before the service call', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/customer-affairs/tickets')
      .send({ ...ticket, description: 'x'.repeat(2001) })
      .expect(400);
    expect(service.createTicket).not.toHaveBeenCalled();
  });
});
