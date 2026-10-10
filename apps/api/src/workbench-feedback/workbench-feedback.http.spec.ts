import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedActor } from '@nora/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import { WorkbenchFeedbackController } from './workbench-feedback.controller';
import { WorkbenchFeedbackService } from './workbench-feedback.service';

const branchId = '33333333-3333-4333-8333-333333333333';
const feedbackId = '44444444-4444-4444-8444-444444444444';
const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: [branchId],
  permissions: [],
};

describe('Workbench feedback HTTP boundary', () => {
  let app: INestApplication;
  const service = {
    create: vi.fn(),
    uploadAttachment: vi.fn().mockResolvedValue({
      data: { id: '55555555-5555-4555-8555-555555555555' },
    }),
    detail: vi.fn(),
    deleteHr: vi.fn().mockResolvedValue(undefined),
  };
  const iam = { authenticate: vi.fn().mockResolvedValue(actor) };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [WorkbenchFeedbackController],
      providers: [
        { provide: WorkbenchFeedbackService, useValue: service },
        { provide: IamService, useValue: iam },
        AuthGuard,
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

  it('accepts a feedback attachment without generic Documents permissions', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/workbench/feedback/${feedbackId}/attachments`)
      .set('Cookie', 'nora_access=test')
      .field('branchId', branchId)
      .field('subject', 'پیشنهاد کارکنان')
      .field('anonymous', 'false')
      .attach('file', Buffer.from('%PDF-test'), {
        filename: 'feedback.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(service.uploadAttachment).toHaveBeenCalledWith(
      {
        feedbackId,
        branchId,
        subject: 'پیشنهاد کارکنان',
        anonymous: false,
      },
      expect.objectContaining({
        originalname: 'feedback.pdf',
        mimetype: 'application/pdf',
      }),
      actor,
      expect.objectContaining({ ipAddress: expect.any(String) }),
    );
  });

  it('routes deletion only through the authenticated HR endpoint', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/workbench/feedback/hr/${feedbackId}`)
      .set('Cookie', 'nora_access=test')
      .expect(200);
    expect(service.deleteHr).toHaveBeenCalledWith(feedbackId, actor);
    await request(app.getHttpServer())
      .delete('/api/v1/workbench/feedback/hr/not-an-id')
      .set('Cookie', 'nora_access=test')
      .expect(400);
  });
});
