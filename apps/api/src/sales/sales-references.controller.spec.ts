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
import { MasterDataController } from '../master-data/master-data.controller';
import { MasterDataService } from '../master-data/master-data.service';
import { MasterSalesDirectory } from '../master-data/master-sales-directory';
import { MasterOrganizationDirectory } from '../master-data/master-organization-directory';
import { SalesReferencesController } from './sales-references.controller';

describe('contract references without Master Data administration', () => {
  let app: INestApplication;
  let actor: AuthenticatedActor;
  const id = '00000000-0000-4000-8000-000000000001';
  const record: MasterDataRecord = {
    id,
    resource: 'hotels',
    code: 'H1',
    name: 'Hotel',
    status: 'active',
    version: 1,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    attributes: {
      cityId: id,
      roomTypeIds: 'room',
      englishName: 'Hotel',
      privateNotes: 'secret',
      phone: 'private',
      accountNumber: 'private',
      contractTerms: 'private',
    },
  };
  const list = vi.fn(async () => ({
    data: [record],
    meta: { total: 1, page: 1, pageSize: 100 },
  }));
  const detail = vi.fn(async () => ({ data: record }));
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SalesReferencesController, MasterDataController],
      providers: [
        AuthGuard,
        PermissionGuard,
        MasterSalesDirectory,
        { provide: MasterOrganizationDirectory, useValue: {} },
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
    list.mockClear();
    detail.mockClear();
    list.mockResolvedValue({
      data: [record],
      meta: { total: 1, page: 1, pageSize: 100 },
    });
    detail.mockResolvedValue({ data: record });
  });
  const get = (path: string) =>
    request(app.getHttpServer())
      .get(path)
      .set('Cookie', 'nora_access=synthetic');
  it('lets contract creators see agencies without customer or B2B directory grants', async () => {
    const organization = { ...record, resource: 'organizations' as const };
    list.mockResolvedValue({
      data: [organization],
      meta: { total: 1, page: 1, pageSize: 100 },
    });
    const response = await get('/sales/form-references/organizations').expect(
      200,
    );
    expect(response.body.data[0]).toMatchObject({ id, attributes: {} });
    await get('/master-data/organizations').expect(403);
    actor.permissions = [...actor.permissions, 'ui.deny.sales.new-contract'];
    await get('/sales/form-references/organizations').expect(403);
  });
  it('allows a create-only manual user to choose active hotel labels and relationships, not confidential attributes', async () => {
    const response = await get('/sales/form-references/hotels?page=2').expect(
      200,
    );
    expect(response.body.data[0].attributes).toEqual({
      cityId: id,
      roomTypeIds: 'room',
      englishName: 'Hotel',
    });
    expect(list).toHaveBeenCalledWith('hotels', {
      search: '',
      page: 2,
      pageSize: 100,
      status: 'active',
      sortBy: 'name',
      sortDirection: 'asc',
    });
  });
  it('preserves native guards on list, detail, export, unmask and mutation APIs', async () => {
    for (const path of [
      '/master-data/hotels',
      `/master-data/hotels/${id}`,
      `/master-data/organization-contacts/${id}/unmask`,
      `/master-data/exports/${id}`,
    ])
      await get(path).expect(403);
    await request(app.getHttpServer())
      .post('/master-data/hotels')
      .set('Cookie', 'nora_access=synthetic')
      .send({ values: { name: 'forbidden' } })
      .expect(403);
    expect(list).not.toHaveBeenCalled();
    expect(detail).not.toHaveBeenCalled();
  });
  it.each([
    'countries',
    'cities',
    'hotels',
    'room-types',
    'visa-services',
    'banks',
    'currencies',
    'airlines',
    'insurance-plans',
    'acquaintance-methods',
    'organizations',
  ] as const)(
    'exposes only safe active picker rows for %s',
    async (resource) => {
      list.mockResolvedValue({
        data: [
          { ...record, resource },
          { ...record, resource, id: 'inactive', status: 'inactive' },
        ],
        meta: { total: 1, page: 1, pageSize: 100 },
      });
      const response = await get(`/sales/form-references/${resource}`).expect(
        200,
      );
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        id,
        resource,
        code: 'H1',
        name: 'Hotel',
        status: 'active',
        version: 1,
      });
      for (const key of [
        'privateNotes',
        'phone',
        'accountNumber',
        'contractTerms',
      ])
        expect(response.body.data[0].attributes).not.toHaveProperty(key);
    },
  );
  it('rejects unauthenticated clients, revoked creation, denied screen and missing branch', async () => {
    await request(app.getHttpServer())
      .get('/sales/form-references/hotels')
      .expect(401);
    actor.permissions = actor.permissions.filter(
      (code) => code !== 'sales.contracts.create',
    );
    await get('/sales/form-references/hotels').expect(403);
    actor.permissions.push(
      'sales.contracts.create',
      'ui.deny.sales.new-contract',
    );
    await get('/sales/form-references/hotels').expect(403);
    actor.permissions = ['sales.contracts.create'];
    actor.branchIds = [];
    await get('/sales/form-references/hotels').expect(403);
    expect(list).not.toHaveBeenCalled();
  });
  it('rejects non-allowlisted resources and inactive/filter/pagination tricks', async () => {
    for (const path of [
      'organization-contacts',
      'exchange-rates',
      'brokers',
      'constructor',
      'toString',
      'hotels?status=inactive',
      'hotels?page=0',
      'hotels?pageSize=1000',
      'hotels?columnFilter1=private',
    ])
      await get('/sales/form-references/' + path).expect(400);
    expect(list).not.toHaveBeenCalled();
  });
  it('projects safe detail for tour insurance, refuses inactive selections and exposes no mutations', async () => {
    detail.mockResolvedValue({
      data: {
        ...record,
        resource: 'insurance-plans',
        attributes: {
          insurerId: id,
          insurerName: 'Insurer',
          privateNotes: 'hidden',
        },
      },
    });
    const response = await get(
      `/sales/form-references/insurance-plans/${id}`,
    ).expect(200);
    expect(response.body.data.attributes).toEqual({
      insurerId: id,
      insurerName: 'Insurer',
    });
    detail.mockResolvedValue({ data: { ...record, status: 'inactive' } });
    await get(`/sales/form-references/hotels/${id}`).expect(404);
    await request(app.getHttpServer())
      .post('/sales/form-references/hotels')
      .set('Cookie', 'nora_access=synthetic')
      .expect(404);
  });
  it('allows legacy creation and scoped editing while limiting payment-only access to banks/currencies', async () => {
    actor.permissions = ['sales.contracts.create'];
    await get('/sales/form-references/hotels').expect(200);
    actor.permissions = [
      'sales.contracts.read.own',
      'sales.contracts.update.own',
    ];
    await get('/sales/form-references/hotels').expect(200);
    actor.permissions = ['sales.contracts.read.own', 'sales.payments.create'];
    await get('/sales/form-references/currencies').expect(200);
    await get('/sales/form-references/hotels').expect(403);
    actor.permissions = ['sales.contracts.read.own', 'sales.payments.read'];
    await get('/sales/form-references/banks').expect(200);
    await get('/sales/form-references/organizations').expect(403);
    actor.permissions = ['master_data.read', 'sales.contracts.read.own'];
    await get('/sales/form-references/hotels').expect(403);
  });
});
