import 'reflect-metadata';
import {
  ForbiddenException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller';
import { IamService } from './iam.service';
import { AuthGuard } from './auth.guard';
import { PermissionGuard } from './permission.guard';

describe('PATCH existing user details HTTP contract', () => {
  let app: INestApplication;
  let allowed = true;
  const actor = { userId: '00000000-0000-4000-8000-000000000001' };
  const target = '00000000-0000-4000-8000-000000000002';
  const update = vi.fn(async () => ({ success: true }));
  beforeAll(async () => {
    const testing = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        PermissionGuard,
        {
          provide: IamService,
          useValue: {
            updateUserDetails: update,
            assertPermissions: (_actor: unknown, codes: string[]) => {
              expect(codes).toEqual(['iam.users.manage']);
              if (!allowed) throw new ForbiddenException();
            },
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => { actor: unknown } };
        }) => {
          context.switchToHttp().getRequest().actor = actor;
          return true;
        },
      })
      .compile();
    app = testing.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  const body = { displayName: 'Updated Full Name', revision: 'a'.repeat(64) };
  it('forwards the existing account and opaque revision to the service', async () => {
    await request(app.getHttpServer())
      .patch(`/iam/users/${target}/details`)
      .send(body)
      .expect(200);
    expect(update).toHaveBeenCalledWith(
      target,
      expect.objectContaining(body),
      actor,
    );
  });
  it('rejects invalid names, IDs and unrelated access fields', async () => {
    update.mockClear();
    await request(app.getHttpServer())
      .patch('/iam/users/invalid/details')
      .send(body)
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/iam/users/${target}/details`)
      .send({ ...body, displayName: 'x' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/iam/users/${target}/details`)
      .send({ ...body, roleIds: [] })
      .expect(400);
    expect(update).not.toHaveBeenCalled();
  });
  it('enforces management authority before mutation', async () => {
    update.mockClear();
    allowed = false;
    await request(app.getHttpServer())
      .patch(`/iam/users/${target}/details`)
      .send(body)
      .expect(403);
    allowed = true;
    expect(update).not.toHaveBeenCalled();
  });
});
