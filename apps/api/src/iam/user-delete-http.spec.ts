import 'reflect-metadata';
import { ForbiddenException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { UsersController } from './users.controller';
import { IamService } from './iam.service';
import { AuthGuard } from './auth.guard';
import { PermissionGuard } from './permission.guard';
import { ManualUserAccessService } from './manual-user-access.service';
describe('DELETE user HTTP contract', () => {
  let app: INestApplication;
  let allowed = true;
  const actor = {
    userId: '00000000-0000-4000-8000-000000000001',
    sessionId: 'session',
    permissions: ['iam.users.manage'],
    branchIds: [],
  };
  const target = '00000000-0000-4000-8000-000000000002';
  const remove = vi.fn(async () => ({ success: true }));
  beforeAll(async () => {
    const testing = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        PermissionGuard,
        {
          provide: IamService,
          useValue: {
            assertPermissions: (_actor: unknown, codes: string[]) => {
              expect(codes).toEqual(['iam.users.manage']);
              if (!allowed) throw new ForbiddenException();
            },
          },
        },
        { provide: ManualUserAccessService, useValue: { delete: remove } },
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
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('forwards UUID, If-Match revision and authenticated actor to the guarded transaction', async () => {
    await request(app.getHttpServer())
      .delete(`/iam/users/${target}`)
      .set('If-Match', 'a'.repeat(64))
      .expect(200, { success: true });
    expect(remove).toHaveBeenCalledWith(target, 'a'.repeat(64), actor);
  });
  it('rejects malformed IDs before invoking deletion', async () => {
    remove.mockClear();
    await request(app.getHttpServer())
      .delete('/iam/users/not-a-uuid')
      .expect(400);
    expect(remove).not.toHaveBeenCalled();
  });
  it('enforces the existing management permission before invoking deletion', async () => {
    remove.mockClear();
    allowed = false;
    await request(app.getHttpServer())
      .delete(`/iam/users/${target}`)
      .expect(403);
    expect(remove).not.toHaveBeenCalled();
    allowed = true;
  });
});
