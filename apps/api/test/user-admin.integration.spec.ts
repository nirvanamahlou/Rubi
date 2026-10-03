import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersController } from '../src/iam/users.controller';
import { IamService } from '../src/iam/iam.service';
const target = '00000000-0000-4000-8000-000000000002';
describe('user administration reset HTTP boundary', () => {
  let app: INestApplication;
  const service = {
    authenticate: vi.fn(),
    assertPermissions: IamService.prototype.assertPermissions,
    resetUserPassword: vi.fn(),
  };
  beforeEach(async () => {
    service.authenticate.mockResolvedValue({
      userId: 'administrator',
      sessionId: 'session',
      permissions: ['iam.users.manage'],
      branchIds: [],
    });
    service.resetUserPassword.mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: IamService, useValue: service }],
    }).compile();
    app = module.createNestApplication();
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
    await app.close();
    vi.clearAllMocks();
  });
  it('requires authentication', async () => {
    await request(app.getHttpServer())
      .patch('/iam/users/' + target + '/password')
      .send({ newPassword: 'New-Synthetic-2026!' })
      .expect(401);
    expect(service.resetUserPassword).not.toHaveBeenCalled();
  });
  it('requires operation permission and explicit JSON reset header', async () => {
    await request(app.getHttpServer())
      .patch('/iam/users/' + target + '/password')
      .set('Cookie', 'nora_access=fixture')
      .send({ newPassword: 'New-Synthetic-2026!' })
      .expect(403);
    service.authenticate.mockResolvedValue({
      userId: 'operator',
      sessionId: 'session',
      permissions: [],
      branchIds: [],
    });
    await request(app.getHttpServer())
      .patch('/iam/users/' + target + '/password')
      .set('Cookie', 'nora_access=fixture')
      .set('X-Nora-Password-Change', '1')
      .send({ newPassword: 'New-Synthetic-2026!' })
      .expect(403);
    expect(service.resetUserPassword).not.toHaveBeenCalled();
  });
  it('rejects invalid identity, short credentials and extra caller identities', async () => {
    for (const [id, body] of [
      ['invalid', { newPassword: 'New-Synthetic-2026!' }],
      [target, { newPassword: 'short' }],
      [target, { newPassword: 'New-Synthetic-2026!', actorId: 'other' }],
    ] as const) {
      await request(app.getHttpServer())
        .patch('/iam/users/' + id + '/password')
        .set('Cookie', 'nora_access=fixture')
        .set('X-Nora-Password-Change', '1')
        .send(body)
        .expect(400);
    }
    expect(service.resetUserPassword).not.toHaveBeenCalled();
  });
  it('passes only server-authenticated actor and returns no credentials', async () => {
    const response = await request(app.getHttpServer())
      .patch('/iam/users/' + target + '/password')
      .set('Cookie', 'nora_access=fixture')
      .set('X-Nora-Password-Change', '1')
      .send({ newPassword: 'New-Synthetic-2026!' })
      .expect(200);
    expect(response.body).toEqual({ success: true });
    expect(service.resetUserPassword).toHaveBeenCalledWith(
      target,
      'New-Synthetic-2026!',
      expect.objectContaining({ userId: 'administrator' }),
      expect.any(Object),
    );
  });
});
