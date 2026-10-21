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
import { HrUserUnitDirectory } from '../hr/hr-user-unit-directory';

describe('PATCH existing user details HTTP contract', () => {
  let app: INestApplication;
  let allowed = true;
  const actor = { userId: '00000000-0000-4000-8000-000000000001' };
  const target = '00000000-0000-4000-8000-000000000002';
  const update = vi.fn(async () => ({ success: true }));
  const create = vi.fn(async () => ({ id: target }));
  const listUnits = vi.fn(async () => [
    { id: target, name: 'Sales', branchId: target },
  ]);
  beforeAll(async () => {
    const testing = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: HrUserUnitDirectory, useValue: { list: listUnits } },
        PermissionGuard,
        {
          provide: IamService,
          useValue: {
            updateUserDetails: update,
            createUser: create,
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
  it('accepts optional HR unit IDs on creation and rejects arbitrary text', async () => {
    const input = {
      username: 'synthetic',
      displayName: 'Synthetic User',
      password: '12345678',
      roleIds: [],
      branchIds: [target],
      organizationUnitId: target,
    };
    await request(app.getHttpServer())
      .post('/iam/users')
      .send(input)
      .expect(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationUnitId: target }),
      actor,
      expect.anything(),
    );
    create.mockClear();
    await request(app.getHttpServer())
      .post('/iam/users')
      .send({ ...input, organizationUnitId: 'Sales' })
      .expect(400);
    expect(create).not.toHaveBeenCalled();
  });
  it('exposes the HR unit directory through the existing account management guard', async () => {
    await request(app.getHttpServer())
      .get('/iam/users/organization-units')
      .expect(200, [{ id: target, name: 'Sales', branchId: target }]);
    expect(listUnits).toHaveBeenCalledWith(actor);
    allowed = false;
    listUnits.mockClear();
    await request(app.getHttpServer())
      .get('/iam/users/organization-units')
      .expect(403);
    expect(listUnits).not.toHaveBeenCalled();
    allowed = true;
  });
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
  it('accepts a real unit UUID or explicit null, but rejects free-text units', async () => {
    await request(app.getHttpServer())
      .patch(`/iam/users/${target}/details`)
      .send({ ...body, organizationUnitId: target })
      .expect(200);
    expect(update).toHaveBeenLastCalledWith(
      target,
      expect.objectContaining({ organizationUnitId: target }),
      actor,
    );
    await request(app.getHttpServer())
      .patch(`/iam/users/${target}/details`)
      .send({ ...body, organizationUnitId: null })
      .expect(200);
    update.mockClear();
    await request(app.getHttpServer())
      .patch(`/iam/users/${target}/details`)
      .send({ ...body, organizationUnitId: 'Sales' })
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
