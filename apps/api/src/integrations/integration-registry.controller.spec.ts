import 'reflect-metadata';
import { ForbiddenException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IamService } from '../iam/iam.service';
import { SystemManagementService } from '../system-management/system-management.service';
import { IntegrationRegistryController } from './integration-registry.controller';
import { IntegrationRegistryService } from './integration-registry.service';

describe('Integration registry HTTP permission contract', () => {
  let app: INestApplication;
  const branchId = randomUUID();
  const actor = {
    userId: randomUUID(),
    sessionId: randomUUID(),
    branchIds: [branchId],
    permissions: ['ui.administrator', 'system.settings.manage'],
  };
  const iam = {
    authenticate: vi.fn(async () => actor),
    assertPermissions: vi.fn((actor, required) => {
      if (
        !required.every((permission: string) =>
          actor.permissions.includes(permission),
        )
      )
        throw new ForbiddenException();
    }),
  };
  const settings = {
    resolveSetting: vi.fn(async () => null),
    writeSetting: vi.fn(),
  };
  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [IntegrationRegistryController],
      providers: [
        IntegrationRegistryService,
        { provide: IamService, useValue: iam },
        { provide: SystemManagementService, useValue: settings },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });
  it('requires an actual IAM authentication boundary', async () => {
    await request(app.getHttpServer())
      .get(`/integrations/v1/registry?branchId=${branchId}`)
      .expect(401);
    expect(settings.resolveSetting).not.toHaveBeenCalled();
  });
  it('reads a noninitialized branch with the existing cookie session contract', async () => {
    const response = await request(app.getHttpServer())
      .get(`/integrations/v1/registry?branchId=${branchId}`)
      .set('Cookie', 'nora_access=test-session')
      .expect(200);
    expect(response.body).toMatchObject({
      contract: 'integrations.registry.v1',
      initialized: false,
      counts: null,
    });
  });
  it('denies a forged branch on an authenticated request', async () => {
    await request(app.getHttpServer())
      .get(`/integrations/v1/registry?branchId=${randomUUID()}`)
      .set('Cookie', 'nora_access=test-session')
      .expect(403);
    expect(settings.resolveSetting).not.toHaveBeenCalled();
  });
  it('rejects missing branch scope instead of using global configuration', async () => {
    await request(app.getHttpServer())
      .get('/integrations/v1/registry')
      .set('Cookie', 'nora_access=test-session')
      .expect(400);
  });
  it('requires management permission on the write endpoint', async () => {
    iam.authenticate.mockResolvedValueOnce({
      ...actor,
      permissions: ['ui.administrator'],
    });
    await request(app.getHttpServer())
      .post(`/integrations/v1/registry?branchId=${branchId}`)
      .set('Cookie', 'nora_access=test-session')
      .send({})
      .expect(403);
    expect(settings.writeSetting).not.toHaveBeenCalled();
  });
});
