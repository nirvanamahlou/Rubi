import {
  Controller,
  Get,
  UseGuards,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
  vi,
  expect,
} from 'vitest';
import request from 'supertest';
import type { AuthenticatedActor } from '@rubi/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import {
  B2bOrganizationUserController,
  B2bPortalController,
} from './b2b-organization-user.controller';
import { B2bOrganizationUserService } from './b2b-organization-user.service';
import { B2bOrganizationUserRepository } from './b2b-organization-user.repository';
import { B2bPortalBoundaryInterceptor } from './b2b-portal-boundary.interceptor';
@Controller('other-module')
@UseGuards(AuthGuard)
class OtherModuleController {
  @Get() read() {
    return { private: 'must never reach portal users' };
  }
}
const id = '11111111-1111-4111-8111-111111111111';
describe('organization users HTTP and global portal boundary', () => {
  let app: INestApplication, actor: AuthenticatedActor;
  let membership: object | null = null;
  const service = {
    list: vi.fn(),
    history: vi.fn(),
    create: vi.fn().mockResolvedValue({ data: { id, version: 1 } }),
    update: vi.fn(),
    identity: vi
      .fn()
      .mockResolvedValue({ data: { sections: ['organization'] } }),
    section: vi.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        B2bOrganizationUserController,
        B2bPortalController,
        OtherModuleController,
      ],
      providers: [
        { provide: B2bOrganizationUserService, useValue: service },
        {
          provide: IamService,
          useValue: {
            authenticate: async () => actor,
            assertPermissions: IamService.prototype.assertPermissions,
          },
        },
        {
          provide: B2bOrganizationUserRepository,
          useValue: { byUser: async () => membership },
        },
        { provide: APP_INTERCEPTOR, useClass: B2bPortalBoundaryInterceptor },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    membership = null;
    actor = { userId: id, sessionId: id, branchIds: [id], permissions: [] };
  });
  afterAll(async () => {
    await app?.close();
  });
  it('requires authentication for the portal', async () => {
    await request(app.getHttpServer()).get('/b2b/portal/me').expect(401);
    expect(service.identity).not.toHaveBeenCalled();
  });
  it('allows a membership portal request with no global IAM roles', async () => {
    membership = { isActive: true };
    await request(app.getHttpServer())
      .get('/b2b/portal/me')
      .set('Cookie', 'rubi_access=test-only')
      .expect(200);
    expect(service.identity).toHaveBeenCalledWith(actor);
  });
  it.each([true, false])(
    'denies other authenticated modules for active/inactive members (%s)',
    async (isActive) => {
      membership = { isActive };
      await request(app.getHttpServer())
        .get('/other-module')
        .set('Cookie', 'rubi_access=test-only')
        .expect(403);
    },
  );
  it('does not affect staff endpoints', async () => {
    await request(app.getHttpServer())
      .get('/other-module')
      .set('Cookie', 'rubi_access=test-only')
      .expect(200);
  });
  it('rejects role injection, forged user linkage and weak DTO fields', async () => {
    actor.permissions = ['b2b.agency.manage'];
    await request(app.getHttpServer())
      .post(`/b2b/agencies/${id}/users`)
      .set('Cookie', 'rubi_access=test-only')
      .send({
        branchId: id,
        displayName: 'Synthetic',
        username: 'synthetic',
        password: 'Test-only-4637!',
        roleName: 'Reader',
        sections: ['organization'],
        isActive: true,
        reason: 'Test request',
        userId: id,
        roleIds: [id],
      })
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('keeps read-only staff from editing memberships', async () => {
    actor.permissions = ['b2b.agency.read'];
    await request(app.getHttpServer())
      .put(`/b2b/agencies/${id}/users/${id}`)
      .set('Cookie', 'rubi_access=test-only')
      .send({})
      .expect(403);
    expect(service.update).not.toHaveBeenCalled();
  });
});
