import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedActor } from '@rubi/contracts';
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
import { B2bController } from './b2b.controller';
import { B2bService } from './b2b.service';
import { B2bAgreementWorkflowService } from './b2b-agreement-workflow.service';
import { agreementTestTerms } from './agreement-test-fixtures';

const id = '11111111-1111-4111-8111-111111111111';
describe('B2B authenticated runtime boundary', () => {
  let app: INestApplication;
  let actor: AuthenticatedActor;
  const service = {
    agencyWorkspace: vi.fn(),
    createAgreement: vi.fn(),
    upsertProfile: vi.fn(),
  };
  const workflow = {
    save: vi.fn(),
    action: vi.fn(),
    list: vi.fn(),
    get: vi.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [B2bController],
      providers: [
        { provide: B2bService, useValue: service },
        { provide: B2bAgreementWorkflowService, useValue: workflow },
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
    actor = { userId: id, sessionId: id, branchIds: [id], permissions: [] };
  });
  afterAll(async () => {
    await app?.close();
  });
  it('returns 401 without authentication', async () => {
    await request(app.getHttpServer()).get(`/b2b/agencies/${id}`).expect(401);
    expect(service.agencyWorkspace).not.toHaveBeenCalled();
  });
  it('validates the complete nested draft DTO and requires a separate review permission', async () => {
    actor.permissions = ['b2b.agreement.manage'];
    await request(app.getHttpServer())
      .post(`/b2b/agencies/${id}/agreements/drafts`)
      .set('Cookie', 'rubi_access=test-only')
      .send({ branchId: id, role: 'CORPORATE_CUSTOMER', requestId: id })
      .expect(400);
    expect(workflow.save).not.toHaveBeenCalled();
    workflow.save.mockResolvedValue({ id });
    await request(app.getHttpServer())
      .post(`/b2b/agencies/${id}/agreements/drafts`)
      .set('Cookie', 'rubi_access=test-only')
      .send({
        branchId: id,
        role: 'CORPORATE_CUSTOMER',
        requestId: id,
        terms: agreementTestTerms(),
      })
      .expect(201);
    expect(workflow.save).toHaveBeenCalledWith(
      id,
      undefined,
      expect.objectContaining({ role: 'CORPORATE_CUSTOMER' }),
      actor,
    );
    await request(app.getHttpServer())
      .post(`/b2b/agencies/${id}/agreements/${id}/review`)
      .set('Cookie', 'rubi_access=test-only')
      .send({
        branchId: id,
        role: 'AGENCY',
        requestId: id,
        version: 1,
        reason: 'Approve',
        decision: 'APPROVE',
      })
      .expect(403);
    expect(workflow.action).not.toHaveBeenCalled();
  });
  it('returns 403 without the complete workspace permissions', async () => {
    actor.permissions = ['b2b.agency.read'];
    await request(app.getHttpServer())
      .get(`/b2b/agencies/${id}`)
      .set('Cookie', 'rubi_access=test-only')
      .expect(403);
    expect(service.agencyWorkspace).not.toHaveBeenCalled();
  });
  it('passes authorized actor and branch to the application boundary', async () => {
    actor.permissions = [
      'b2b.agency.read',
      'b2b.agreement.read',
      'b2b.credit.read',
      'b2b.rate.read',
    ];
    service.agencyWorkspace.mockResolvedValue({ data: null });
    await request(app.getHttpServer())
      .get(`/b2b/agencies/${id}`)
      .set('Cookie', 'rubi_access=test-only')
      .set('x-branch-id', id)
      .expect(200);
    expect(service.agencyWorkspace).toHaveBeenCalledWith(id, actor, id);
  });
  it('validates DTOs at runtime before a mutation', async () => {
    actor.permissions = ['b2b.agreement.manage'];
    await request(app.getHttpServer())
      .post(`/b2b/agencies/${id}/agreements`)
      .set('Cookie', 'rubi_access=test-only')
      .send({
        branchId: id,
        title: 'Synthetic agreement',
        startsAt: '2026-02-30',
      })
      .expect(400);
    expect(service.createAgreement).not.toHaveBeenCalled();
  });
  it('rejects malformed organization references before persistence', async () => {
    actor.permissions = ['b2b.agency.manage'];
    await request(app.getHttpServer())
      .put('/b2b/agencies/invalid/profile')
      .set('Cookie', 'rubi_access=test-only')
      .send({ branchId: id })
      .expect(400);
    expect(service.upsertProfile).not.toHaveBeenCalled();
  });
});
