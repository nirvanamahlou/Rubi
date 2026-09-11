import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { INestApplication } from '@nestjs/common';

import { AuthController } from '../src/iam/auth.controller';
import { IamService } from '../src/iam/iam.service';

describe('IAM login and refresh HTTP contract', () => {
  let app: INestApplication;
  const service = {
    login: vi.fn(),
    refresh: vi.fn(),
    authenticate: vi.fn(),
    changePassword: vi.fn(),
  };

  beforeEach(async () => {
    service.authenticate.mockResolvedValue({
      userId: 'self',
      sessionId: 'session',
      permissions: [],
      branchIds: [],
    });
    service.changePassword.mockResolvedValue(undefined);
    service.login.mockResolvedValue({
      accessToken: 'access.jwt',
      refreshToken: 'session.secret',
      expiresAt: new Date('2030-01-01T00:00:00Z'),
      body: { user: { id: 'u1' } },
    });
    service.refresh.mockResolvedValue({
      accessToken: 'next.jwt',
      refreshToken: 'next.secret',
      expiresAt: new Date('2030-01-02T00:00:00Z'),
      body: { user: { id: 'u1' } },
    });
    const module = await Test.createTestingModule({
      controllers: [AuthController],
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

  it('validates login and writes only HttpOnly cookies', async () => {
    const response = await request(app.getHttpServer())
      .post('/iam/auth/login')
      .send({ username: 'ramtin', password: 'Rubi-Strong-2026!' })
      .expect(200);
    expect(response.body).toEqual({ user: { id: 'u1' } });
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.join(';')).toContain('rubi_access=access.jwt');
    expect(cookies.join(';')).toContain('rubi_refresh=session.secret');
    expect(cookies.every((cookie) => cookie.includes('HttpOnly'))).toBe(true);
  });

  it('passes the opaque refresh cookie to rotation service', async () => {
    await request(app.getHttpServer())
      .post('/iam/auth/refresh')
      .set('Cookie', 'rubi_refresh=session.secret')
      .expect(200);
    expect(service.refresh).toHaveBeenCalledWith(
      'session.secret',
      expect.any(Object),
    );
  });

  it('rejects invalid login payload before authentication', async () => {
    await request(app.getHttpServer())
      .post('/iam/auth/login')
      .send({ username: '?', password: 'short' })
      .expect(400);
    expect(service.login).not.toHaveBeenCalled();
  });

  it('requires authentication for password changes', async () => {
    await request(app.getHttpServer())
      .post('/iam/auth/change-password')
      .set('X-Rubi-Password-Change', '1')
      .send({
        currentPassword: 'Old-Fixture-123!',
        newPassword: 'New-Fixture-456!',
      })
      .expect(401);
    expect(service.changePassword).not.toHaveBeenCalled();
  });

  it('exposes password capability only to authenticated clients without collecting credentials', async () => {
    await request(app.getHttpServer())
      .get('/iam/auth/password-change/status')
      .expect(401);
    const response = await request(app.getHttpServer())
      .get('/iam/auth/password-change/status')
      .set('Cookie', 'rubi_access=fixture')
      .expect(200);
    expect(response.body).toEqual({ available: true });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(service.changePassword).not.toHaveBeenCalled();
  });

  it('rejects requests without the CSRF header and caller-supplied identities', async () => {
    await request(app.getHttpServer())
      .post('/iam/auth/change-password')
      .set('Cookie', 'rubi_access=fixture')
      .send({
        currentPassword: 'Old-Fixture-123!',
        newPassword: 'New-Fixture-456!',
      })
      .expect(403);
    await request(app.getHttpServer())
      .post('/iam/auth/change-password')
      .set('Cookie', 'rubi_access=fixture')
      .set('X-Rubi-Password-Change', '1')
      .send({
        currentPassword: 'Old-Fixture-123!',
        newPassword: 'New-Fixture-456!',
        userId: 'other',
      })
      .expect(400);
    expect(service.changePassword).not.toHaveBeenCalled();
  });

  it('uses the authenticated actor and clears both cookies only after successful change', async () => {
    const response = await request(app.getHttpServer())
      .post('/iam/auth/change-password')
      .set('Cookie', 'rubi_access=fixture')
      .set('X-Rubi-Password-Change', '1')
      .send({
        currentPassword: 'Old-Fixture-123!',
        newPassword: 'New-Fixture-456!',
      })
      .expect(204);
    expect(service.changePassword).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'self' }),
      'Old-Fixture-123!',
      'New-Fixture-456!',
      expect.any(Object),
    );
    expect(response.headers['cache-control']).toBe('no-store');
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies).toHaveLength(2);
    expect(
      cookies.every(
        (cookie) =>
          cookie.includes('HttpOnly') &&
          cookie.includes('Expires=Thu, 01 Jan 1970'),
      ),
    ).toBe(true);
  });
});
