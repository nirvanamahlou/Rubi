import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedActor } from '@nora/contracts';
import request from 'supertest';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { AuthGuard } from '../../iam/auth.guard';
import { IamService } from '../../iam/iam.service';
import { PermissionGuard } from '../../iam/permission.guard';
import { BankAccountController } from './bank-account.controller';
import { BankAccountService } from './bank-account.service';

describe('company bank account HTTP routing and native permission guard', () => {
  let app: INestApplication;
  let actor: AuthenticatedActor;
  const service = {
    remove: vi.fn().mockResolvedValue({ id: 'account-id' }),
    list: vi.fn().mockResolvedValue({ items: [], hasMore: false, page: 1 }),
    options: vi
      .fn()
      .mockResolvedValue({ branches: [], currencies: [], canManage: true }),
    details: vi.fn().mockResolvedValue({ accountNumber: '00012345' }),
    save: vi
      .fn()
      .mockResolvedValue({ id: 'synthetic', accountNumber: '••••2345' }),
  };
  beforeEach(() => {
    actor = {
      userId: 'synthetic',
      sessionId: 'synthetic',
      branchIds: ['synthetic'],
      permissions: [
        'master_data.read',
        'finance.read',
        'finance.account.manage',
      ],
    };
    vi.clearAllMocks();
  });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [BankAccountController],
      providers: [
        { provide: BankAccountService, useValue: service },
        PermissionGuard,
        {
          provide: IamService,
          useValue: {
            assertPermissions: IamService.prototype.assertPermissions,
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => {
            getRequest: () => { actor: AuthenticatedActor };
          };
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
  it('routes create/edit/explicit detail reads with no-store responses', async () => {
    const base = '/finance/banks/bank-id/accounts';
    const body = { title: 'Synthetic', accountNumber: '00012345' };
    const created = await request(app.getHttpServer())
      .post(base)
      .send(body)
      .expect(201);
    expect(created.headers['cache-control']).toContain('no-store');
    expect(created.body.accountNumber).toBe('••••2345');
    expect(service.save).toHaveBeenLastCalledWith('bank-id', null, body, actor);
    await request(app.getHttpServer())
      .patch(`${base}/account-id`)
      .send({ ...body, expectedVersion: 1 })
      .expect(200);
    expect(service.save).toHaveBeenLastCalledWith(
      'bank-id',
      'account-id',
      { ...body, expectedVersion: 1 },
      actor,
    );
    const full = await request(app.getHttpServer())
      .post(`${base}/account-id/details`)
      .expect(200);
    expect(full.headers['cache-control']).toContain('no-store');
    expect(service.details).toHaveBeenCalledWith(
      'bank-id',
      'account-id',
      actor,
    );
    await request(app.getHttpServer())
      .get(`${base}/account-id/details`)
      .expect(404);
    const removed = await request(app.getHttpServer())
      .delete(`${base}/account-id`)
      .send({ expectedVersion: 3 })
      .expect(200);
    expect(removed.headers['cache-control']).toContain('no-store');
    expect(service.remove).toHaveBeenCalledWith(
      'bank-id',
      'account-id',
      { expectedVersion: 3 },
      actor,
    );
  });
  it('permits masked reads but denies full reads and writes without account management', async () => {
    actor = { ...actor, permissions: ['master_data.read', 'finance.read'] };
    const base = '/finance/banks/bank-id/accounts';
    await request(app.getHttpServer()).get(`${base}?page=2`).expect(200);
    expect(service.list).toHaveBeenCalledWith('bank-id', '2', actor);
    await request(app.getHttpServer())
      .post(`${base}/account-id/details`)
      .expect(403);
    await request(app.getHttpServer()).post(base).send({}).expect(403);
    await request(app.getHttpServer())
      .patch(`${base}/account-id`)
      .send({})
      .expect(403);
    expect(service.details).not.toHaveBeenCalled();
    expect(service.save).not.toHaveBeenCalled();
    await request(app.getHttpServer())
      .delete(`${base}/account-id`)
      .send({ expectedVersion: 1 })
      .expect(403);
    expect(service.remove).not.toHaveBeenCalled();
    actor = { ...actor, permissions: ['master_data.read'] };
    await request(app.getHttpServer()).get(base).expect(403);
  });
});
