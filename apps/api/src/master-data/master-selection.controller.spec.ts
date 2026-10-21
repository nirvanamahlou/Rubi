import 'reflect-metadata';
import {
  ForbiddenException,
  ValidationPipe,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MANUAL_ACCESS_VERSION,
  type AuthenticatedActor,
  type MasterDataRecord,
} from '@nora/contracts';
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
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import { PermissionGuard } from '../iam/permission.guard';
import { MasterDataController } from './master-data.controller';
import { MasterDataService } from './master-data.service';
import { MasterDataRepository } from './master-data.repository';
import { MasterSelectionController } from './master-selection.controller';
import { MasterSelectionDirectory } from './master-selection.directory';

describe('consumer-scoped reference selection', () => {
  it('does not let reference search probe private organization identifiers', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const repository = new MasterDataRepository({
      client: { masterOrganization: { findMany, count } },
    } as never);
    await repository.list(
      'organizations',
      {
        search: 'private-id-probe',
        status: 'active',
        page: 1,
        pageSize: 25,
        sortBy: 'name',
        sortDirection: 'asc',
      },
      true,
    );
    expect(findMany.mock.calls[0]![0].where.OR).toEqual([
      { legalName: { contains: 'private-id-probe', mode: 'insensitive' } },
      { code: { contains: 'private-id-probe', mode: 'insensitive' } },
      { displayName: { contains: 'private-id-probe', mode: 'insensitive' } },
    ]);
  });
  let app: INestApplication;
  let actor: AuthenticatedActor;
  const id = '00000000-0000-4000-8000-000000000001';
  const row: MasterDataRecord = {
    id,
    resource: 'cities',
    code: 'CITY',
    name: 'City',
    status: 'active',
    attributes: {
      countryId: id,
      englishName: 'City',
      privateNotes: 'secret',
      phone: 'private',
      accountNumber: 'private',
    },
    version: 1,
    createdAt: '',
    updatedAt: '',
  };
  const list = vi.fn();
  const detail = vi.fn();
  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Cookie', 'nora_access=synthetic');
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [MasterSelectionController, MasterDataController],
      providers: [
        AuthGuard,
        PermissionGuard,
        MasterSelectionDirectory,
        { provide: MasterDataService, useValue: { list, detail } },
        {
          provide: IamService,
          useValue: {
            authenticate: async () => actor,
            assertPermissions: (user: AuthenticatedActor, codes: string[]) => {
              if (
                codes.some(
                  (code) => !user.permissions.some((grant) => grant === code),
                )
              )
                throw new ForbiddenException();
            },
          },
        },
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
  afterAll(async () => {
    await app?.close();
  });
  beforeEach(() => {
    actor = {
      userId: id,
      sessionId: 'test',
      branchIds: [id],
      permissions: [
        MANUAL_ACCESS_VERSION,
        'sales.contracts.create',
        'ui.screen.sales.new-contract',
        'ui.deny.master-data.home',
      ],
    };
    list.mockReset().mockResolvedValue({
      data: [row, { ...row, id: 'old', status: 'inactive' }],
      meta: { total: 1, page: 1, pageSize: 100 },
    });
    detail.mockReset().mockResolvedValue({ data: row });
  });
  it('provides active choices without granting Master Data administration', async () => {
    const response = await get(
      '/master-data/selections/sales/cities?status=all&page=2',
    ).expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].attributes).toEqual({
      countryId: id,
      englishName: 'City',
    });
    expect(list).toHaveBeenCalledWith(
      'cities',
      expect.objectContaining({
        status: 'active',
        page: 2,
        sortBy: 'name',
        sortDirection: 'asc',
      }),
      true,
    );
    await get('/master-data/cities').expect(403);
    await get(`/master-data/cities/${id}`).expect(403);
    await get(`/master-data/exports/${id}`).expect(403);
    await get(`/master-data/organization-contacts/${id}/unmask`).expect(403);
    await request(app.getHttpServer())
      .post('/master-data/cities')
      .set('Cookie', 'nora_access=synthetic')
      .send({})
      .expect(403);
  });
  it.each([
    [
      'sales',
      'sales.contracts.create',
      'ui.screen.sales.new-contract',
      'cities',
    ],
    [
      'reservations',
      'reservations.read',
      'ui.screen.reservations.home',
      'hotels',
    ],
    ['customers', 'customers.read', 'ui.screen.customers.home', 'cities'],
    [
      'organizations',
      'b2b.agency.read',
      'ui.screen.organizations.home',
      'currencies',
    ],
    [
      'accounting',
      'finance.account.manage',
      'ui.screen.finance.home',
      'currencies',
    ],
    [
      'marketing',
      'marketing.read',
      'ui.screen.marketing.home',
      'organizations',
    ],
    [
      'procurement',
      'procurement.read.own',
      'ui.screen.purchases.home',
      'suppliers',
    ],
    [
      'ticket-catalog',
      'ticket_catalog.read',
      'ui.screen.ticket-catalog.home',
      'airlines',
    ],
  ])(
    'authorizes %s by the consuming workflow, not the source grant',
    async (workflow, permission, screen, resource) => {
      actor.permissions = [permission as never];
      list.mockResolvedValue({
        data: [{ ...row, resource }],
        meta: { total: 1, page: 1, pageSize: 100 },
      });
      await get(`/master-data/selections/${workflow}/${resource}`).expect(200);
      // A screen by itself is not a native business permission.
      actor.permissions = [MANUAL_ACCESS_VERSION, screen as never];
      await get(`/master-data/selections/${workflow}/${resource}`).expect(403);
    },
  );
  it('requires authentication, native authority, branch and an allowed consumer screen', async () => {
    await request(app.getHttpServer())
      .get('/master-data/selections/sales/cities')
      .expect(401);
    actor.branchIds = [];
    await get('/master-data/selections/sales/cities').expect(403);
    actor.branchIds = [id];
    actor.permissions = [
      MANUAL_ACCESS_VERSION,
      'sales.contracts.create',
      'ui.deny.sales.new-contract',
      'ui.deny.sales.home',
    ];
    await get('/master-data/selections/sales/cities').expect(403);
    actor.permissions = ['master_data.read'];
    await get('/master-data/selections/sales/cities').expect(403);
    expect(list).not.toHaveBeenCalled();
  });
  it('rejects arbitrary resources, malformed ids, unknown contexts and invalid pagination', async () => {
    for (const path of [
      'sales/organization-contacts',
      'sales/exchange-rates',
      'sales/constructor',
      'sales/cities?page=0',
      'sales/cities?pageSize=1000',
      'sales/cities/not-a-uuid',
    ])
      await get('/master-data/selections/' + path).expect(400);
    await get('/master-data/selections/constructor/cities').expect(403);
    await get('/master-data/selections/unknown/cities').expect(403);
    expect(list).not.toHaveBeenCalled();
    expect(detail).not.toHaveBeenCalled();
  });
  it('retains minimal historical labels, without opening mutation endpoints', async () => {
    detail.mockResolvedValue({ data: { ...row, status: 'inactive' } });
    const response = await get(
      `/master-data/selections/sales/cities/${id}`,
    ).expect(200);
    expect(response.body.data.status).toBe('inactive');
    expect(response.body.data.attributes).toEqual({
      countryId: id,
      englishName: 'City',
    });
    await request(app.getHttpServer())
      .post('/master-data/selections/sales/cities')
      .set('Cookie', 'nora_access=synthetic')
      .send({})
      .expect(404);
  });
});
