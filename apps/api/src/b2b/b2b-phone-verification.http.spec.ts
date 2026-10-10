import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedActor } from '@nora/contracts';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { IamService } from '../iam/iam.service';
import { B2bPhoneVerificationController } from './b2b-phone-verification.controller';
import { B2bPhoneVerificationService } from './b2b-phone-verification.service';

const branchId = '11111111-1111-4111-8111-111111111111';
const registrationId = '22222222-2222-4222-8222-222222222222';
const organizationId = '44444444-4444-4444-8444-444444444444';
const challengeId = '55555555-5555-4555-8555-555555555555';
const body = {
  registrationId,
  branchId,
  role: 'AGENCY',
  organizationId,
  phone: '09121234567',
};

describe('B2B phone verification HTTP boundary', () => {
  let app: INestApplication;
  let actor: AuthenticatedActor;
  const service = {
    challenge: vi.fn(),
    verify: vi.fn(),
    createVerifiedContact: vi.fn(),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [B2bPhoneVerificationController],
      providers: [
        { provide: B2bPhoneVerificationService, useValue: service },
        {
          provide: IamService,
          useValue: {
            authenticate: async () => actor,
            assertPermissions: IamService.prototype.assertPermissions,
          },
        },
      ],
    }).compile();
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
  beforeEach(() => {
    vi.clearAllMocks();
    actor = {
      userId: registrationId,
      sessionId: registrationId,
      branchIds: [branchId],
      permissions: [],
    };
  });
  afterAll(async () => app?.close());

  it('requires authentication and both existing Master Data permissions', async () => {
    await request(app.getHttpServer())
      .post('/b2b/cooperation/phone-verification/challenges')
      .send(body)
      .expect(401);
    actor.permissions = ['master_data.read'];
    await request(app.getHttpServer())
      .post('/b2b/cooperation/phone-verification/challenges')
      .set('Cookie', 'nora_access=test-only')
      .send(body)
      .expect(403);
    expect(service.challenge).not.toHaveBeenCalled();
  });

  it('validates request bodies and applies no-store to every sensitive response', async () => {
    actor.permissions = ['master_data.read', 'master_data.create'];
    service.challenge.mockResolvedValue({ challengeId });
    service.verify.mockResolvedValue({ grant: 'grant' });
    service.createVerifiedContact.mockResolvedValue({
      data: { id: 'contact' },
    });

    await request(app.getHttpServer())
      .post('/b2b/cooperation/phone-verification/challenges')
      .set('Cookie', 'nora_access=test-only')
      .send({ ...body, unexpected: true })
      .expect(400);
    const challenge = await request(app.getHttpServer())
      .post('/b2b/cooperation/phone-verification/challenges')
      .set('Cookie', 'nora_access=test-only')
      .send(body)
      .expect(201);
    expect(challenge.headers['cache-control']).toBe('no-store');

    await request(app.getHttpServer())
      .post(
        `/b2b/cooperation/phone-verification/challenges/${challengeId}/verify`,
      )
      .set('Cookie', 'nora_access=test-only')
      .send({ ...body, code: '12345' })
      .expect(400);
    const verified = await request(app.getHttpServer())
      .post(
        `/b2b/cooperation/phone-verification/challenges/${challengeId}/verify`,
      )
      .set('Cookie', 'nora_access=test-only')
      .send({ ...body, code: '123456' })
      .expect(201);
    expect(verified.headers['cache-control']).toBe('no-store');

    const contact = await request(app.getHttpServer())
      .post('/b2b/cooperation/phone-verification/contacts')
      .set('Cookie', 'nora_access=test-only')
      .send({
        ...body,
        grant: 'x'.repeat(43),
        fullName: 'نماینده آزمایشی',
        email: '',
      })
      .expect(201);
    expect(contact.headers['cache-control']).toBe('no-store');
    await request(app.getHttpServer())
      .post('/b2b/cooperation/phone-verification/contacts')
      .set('Cookie', 'nora_access=test-only')
      .send({
        ...body,
        organizationId: undefined,
        grant: 'x'.repeat(43),
        fullName: 'نماینده آزمایشی',
      })
      .expect(400);
    expect(service.createVerifiedContact).toHaveBeenCalledWith(
      expect.objectContaining({ phone: body.phone, organizationId }),
      actor,
    );
  });
});
