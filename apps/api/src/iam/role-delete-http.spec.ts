import 'reflect-metadata';
import { ForbiddenException, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { RolesController } from './roles.controller';
import { IamService } from './iam.service';
import { AuthGuard } from './auth.guard';
import { PermissionGuard } from './permission.guard';
describe('role directory/delete HTTP contract', () => {
  let app: INestApplication;
  let allowed = true;
  const actor = {
    userId: '00000000-0000-4000-8000-000000000001',
    sessionId: 's',
    permissions: ['iam.users.manage'],
    branchIds: [],
  };
  const id = '00000000-0000-4000-8000-000000000002';
  const remove = vi.fn(async () => ({ success: true }));
  const directory = vi.fn(async () => [
    { id, name: 'Synthetic role', canDelete: true },
  ]);
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [RolesController],
      providers: [
        PermissionGuard,
        {
          provide: IamService,
          useValue: {
            deleteRole: remove,
            listRoleDirectory: directory,
            assertPermissions: (_actor: unknown, permissions: string[]) => {
              expect(permissions).toEqual(['iam.users.manage']);
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
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('lists roles through the authenticated administration service', async () => {
    await request(app.getHttpServer())
      .get('/iam/access-options/roles')
      .expect(200);
    expect(directory).toHaveBeenCalledWith(actor);
  });
  it('forwards the selected UUID and If-Match revision on permanent deletion', async () => {
    await request(app.getHttpServer())
      .delete(`/iam/access-options/roles/${id}`)
      .set('If-Match', 'a'.repeat(64))
      .expect(200, { success: true });
    expect(remove).toHaveBeenCalledWith(id, 'a'.repeat(64), actor);
  });
  it('rejects invalid UUIDs before deletion', async () => {
    remove.mockClear();
    await request(app.getHttpServer())
      .delete('/iam/access-options/roles/invalid')
      .expect(400);
    expect(remove).not.toHaveBeenCalled();
  });
  it('protects both directory and deletion with the native administration permission', async () => {
    allowed = false;
    remove.mockClear();
    directory.mockClear();
    await request(app.getHttpServer())
      .get('/iam/access-options/roles')
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/iam/access-options/roles/${id}`)
      .expect(403);
    expect(remove).not.toHaveBeenCalled();
    expect(directory).not.toHaveBeenCalled();
    allowed = true;
  });
});
