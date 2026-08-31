import {
  ForbiddenException,
  UnauthorizedException,
  ValidationPipe,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedActor } from '@rubi/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../src/iam/auth.guard';
import { IamService } from '../src/iam/iam.service';
import { MasterDataController } from '../src/master-data/master-data.controller';
import { MasterDataService } from '../src/master-data/master-data.service';

describe('Master Data DELETE HTTP contract', () => {
  let app: INestApplication;
  let signedIn = true;
  let permitted = true;
  const id = '44444444-4444-4444-8444-444444444444';
  const remove = vi.fn();
  const actor: AuthenticatedActor = {
    userId: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    permissions: ['master_data.delete'],
    branchIds: ['33333333-3333-4333-8333-333333333333'],
  };

  beforeEach(async () => {
    signedIn = true;
    permitted = true;
    remove.mockResolvedValue({
      data: { id, resource: 'banks', deleted: true },
    });
    const module = await Test.createTestingModule({
      controllers: [MasterDataController],
      providers: [
        { provide: MasterDataService, useValue: { remove } },
        {
          provide: IamService,
          useValue: {
            assertPermissions: (
              _actor: AuthenticatedActor,
              permissions: string[],
            ) => {
              expect(permissions).toEqual(['master_data.delete']);
              if (!permitted) throw new ForbiddenException();
            },
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate(context: ExecutionContext) {
          if (!signedIn) throw new UnauthorizedException();
          context.switchToHttp().getRequest().actor = actor;
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
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

  it('forwards the exact id/version and trusted actor, returning a deletion receipt', async () => {
    await request(app.getHttpServer())
      .delete(`/api/v1/master-data/banks/${id}`)
      .set('x-branch-id', actor.branchIds[0]!)
      .send({ version: 3 })
      .expect(200)
      .expect({ data: { id, resource: 'banks', deleted: true } });
    expect(remove).toHaveBeenCalledWith(
      'banks',
      id,
      3,
      actor,
      actor.branchIds[0],
    );
  });

  it.each([
    {},
    { version: 0 },
    { version: 1.5 },
    { version: '3' },
    { version: 2147483647 },
    { version: 1, actorUserId: id },
  ])('rejects invalid deletion payload %j', async (payload) => {
    await request(app.getHttpServer())
      .delete(`/api/v1/master-data/banks/${id}`)
      .send(payload)
      .expect(400);
    expect(remove).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    signedIn = false;
    await request(app.getHttpServer())
      .delete(`/api/v1/master-data/banks/${id}`)
      .send({ version: 1 })
      .expect(401);
    expect(remove).not.toHaveBeenCalled();
  });

  it('enforces the dedicated delete permission at the HTTP boundary', async () => {
    permitted = false;
    await request(app.getHttpServer())
      .delete(`/api/v1/master-data/banks/${id}`)
      .send({ version: 1 })
      .expect(403);
    expect(remove).not.toHaveBeenCalled();
  });
});
