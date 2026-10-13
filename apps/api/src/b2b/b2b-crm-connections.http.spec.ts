import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedActor } from '@nora/contracts';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import request from 'supertest';

import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import { PermissionGuard } from '../iam/permission.guard';
import { B2bCrmConnectionsController } from './b2b-crm-connections.controller';
import { B2bCrmConnectionsService } from './b2b-crm-connections.service';

const organizationId = '11111111-1111-4111-8111-111111111111';
const contractId = '22222222-2222-4222-8222-222222222222';
const branchId = '33333333-3333-4333-8333-333333333333';

describe('B2B CRM payment documents HTTP boundary', () => {
  let app: INestApplication;
  let actor: AuthenticatedActor;
  const service = {
    get: vi.fn(),
    paymentDocuments: vi.fn().mockResolvedValue({
      version: 1,
      organizationId,
      branchId,
      contractId,
      payments: [],
      observedAt: '2026-10-03T00:00:00.000Z',
    }),
  };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [B2bCrmConnectionsController],
      providers: [
        AuthGuard,
        PermissionGuard,
        { provide: B2bCrmConnectionsService, useValue: service },
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
    await app.init();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    actor = {
      userId: organizationId,
      sessionId: contractId,
      branchIds: [branchId],
      permissions: ['b2b.agency.read'],
    };
  });

  afterAll(async () => app?.close());

  it('requires authentication and the B2B read permission', async () => {
    await request(app.getHttpServer())
      .get(
        `/b2b/agencies/${organizationId}/crm-connections/contracts/${contractId}/payment-documents`,
      )
      .expect(401);
    actor.permissions = [];
    await request(app.getHttpServer())
      .get(
        `/b2b/agencies/${organizationId}/crm-connections/contracts/${contractId}/payment-documents`,
      )
      .set('Cookie', 'nora_access=test-only')
      .set('X-Branch-Id', branchId)
      .expect(403);
    expect(service.paymentDocuments).not.toHaveBeenCalled();
  });

  it('forwards the selected branch and returns private no-store metadata', async () => {
    const response = await request(app.getHttpServer())
      .get(
        `/b2b/agencies/${organizationId}/crm-connections/contracts/${contractId}/payment-documents`,
      )
      .set('Cookie', 'nora_access=test-only')
      .set('X-Branch-Id', branchId)
      .expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers.vary).toContain('X-Branch-Id');
    expect(service.paymentDocuments).toHaveBeenCalledWith(
      organizationId,
      contractId,
      actor,
      branchId,
    );
  });
});
