import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedActor } from '@rubi/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import { PermissionGuard } from '../iam/permission.guard';
import { MasterDataLogoController } from './master-data-logo.controller';
import { MasterDataLogoService } from './master-data-logo.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: ['master_data.update'],
};

describe('Master Data logo HTTP boundary', () => {
  let app: INestApplication;
  const logos = {
    replace: vi.fn().mockResolvedValue({ data: { id: 'record-id' } }),
    remove: vi.fn().mockResolvedValue({ data: { id: 'record-id' } }),
  };
  const iam = {
    authenticate: vi.fn().mockResolvedValue(actor),
    assertPermissions: vi.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MasterDataLogoController],
      providers: [
        { provide: MasterDataLogoService, useValue: logos },
        AuthGuard,
        PermissionGuard,
        { provide: IamService, useValue: iam },
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

  it('accepts an airline PNG with its optimistic version using only master_data.update', async () => {
    const recordId = '44444444-4444-4444-8444-444444444444';
    await request(app.getHttpServer())
      .post(`/api/v1/master-data/airlines/${recordId}/logo`)
      .set('Cookie', 'rubi_access=test')
      .set('x-branch-id', actor.branchIds[0]!)
      .field('title', 'لوگوی ایرلاین')
      .field('version', '3')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'airline.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(iam.assertPermissions).toHaveBeenCalledWith(actor, [
      'master_data.update',
    ]);
    expect(logos.replace).toHaveBeenCalledWith(
      'airlines',
      recordId,
      { title: 'لوگوی ایرلاین', version: 3 },
      expect.objectContaining({
        originalname: 'airline.png',
        mimetype: 'image/png',
      }),
      actor,
      expect.objectContaining({ ipAddress: expect.any(String) }),
      actor.branchIds[0],
    );
  });

  it('rejects a missing optimistic version before reaching the service', async () => {
    await request(app.getHttpServer())
      .post(
        '/api/v1/master-data/airlines/44444444-4444-4444-8444-444444444444/logo',
      )
      .set('Cookie', 'rubi_access=test')
      .field('title', 'لوگوی ایرلاین')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: 'airline.png',
        contentType: 'image/png',
      })
      .expect(400);
    expect(logos.replace).not.toHaveBeenCalled();
  });

  it('removes a logo with the same narrow permission and version check', async () => {
    const recordId = '44444444-4444-4444-8444-444444444444';
    await request(app.getHttpServer())
      .delete(`/api/v1/master-data/hotels/${recordId}/logo`)
      .set('Cookie', 'rubi_access=test')
      .send({ version: 4 })
      .expect(200);
    expect(logos.remove).toHaveBeenCalledWith(
      'hotels',
      recordId,
      4,
      actor,
      expect.any(Object),
      undefined,
    );
  });
});
