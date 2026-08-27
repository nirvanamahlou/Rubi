import {
  ValidationPipe,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../src/iam/auth.guard';
import { PermissionGuard } from '../src/iam/permission.guard';
import { MasterDataController } from '../src/master-data/master-data.controller';
import { MasterDataService } from '../src/master-data/master-data.service';

describe('Master Data HTTP contract', () => {
  let app: INestApplication;
  const service = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    status: vi.fn(),
    downloadXlsx: vi.fn(),
  };
  const authGuard: CanActivate = {
    canActivate(context: ExecutionContext) {
      const requestObject = context.switchToHttp().getRequest();
      requestObject.actor = {
        userId: '11111111-1111-4111-8111-111111111111',
        sessionId: '22222222-2222-4222-8222-222222222222',
        permissions: ['master_data.read', 'master_data.create'],
        branchIds: ['33333333-3333-4333-8333-333333333333'],
      };
      return true;
    },
  };

  beforeEach(async () => {
    service.list.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 25, total: 0 },
    });
    service.create.mockResolvedValue({ data: { id: 'record-id' } });
    service.downloadXlsx.mockResolvedValue({
      buffer: Buffer.from('xlsx-file'),
      fileName: 'master-data-countries-2026-08-26.xlsx',
      mimeType:
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      requestId: '77777777-7777-4777-8777-777777777777',
    });
    const module = await Test.createTestingModule({
      controllers: [MasterDataController],
      providers: [{ provide: MasterDataService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuard)
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
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

  it('downloads the generated XLSX with attachment headers', async () => {
    await request(app.getHttpServer())
      .post('/master-data/exports/xlsx/download')
      .send({
        resource: 'countries',
        format: 'xlsx',
        filters: {
          search: '',
          status: 'all',
          sortBy: 'name',
          sortDirection: 'asc',
        },
        columns: ['code', 'name', 'status', 'updatedAt'],
        locale: 'fa-IR',
        timezone: 'Asia/Tehran',
      })
      .expect(200)
      .expect(
        'content-type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
      .expect('content-disposition', /master-data-countries-2026-08-26\.xlsx/);
    expect(service.downloadXlsx).toHaveBeenCalledWith(
      expect.objectContaining({ resource: 'countries', format: 'xlsx' }),
      expect.objectContaining({ userId: expect.any(String) }),
      undefined,
    );
  });

  it('normalizes pagination through the versioned list DTO', async () => {
    await request(app.getHttpServer())
      .get('/master-data/countries?search=ایران&page=1&pageSize=25')
      .expect(200);
    expect(service.list).toHaveBeenCalledWith(
      'countries',
      expect.objectContaining({ search: 'ایران', page: 1, pageSize: 25 }),
    );
  });

  it('validates and forwards geography list filters', async () => {
    await request(app.getHttpServer())
      .get(
        '/master-data/airports?countryId=44444444-4444-4444-8444-444444444444&regionId=55555555-5555-4555-8555-555555555555&cityId=66666666-6666-4666-8666-666666666666&page=1&pageSize=25',
      )
      .expect(200);
    expect(service.list).toHaveBeenCalledWith(
      'airports',
      expect.objectContaining({
        countryId: '44444444-4444-4444-8444-444444444444',
        regionId: '55555555-5555-4555-8555-555555555555',
        cityId: '66666666-6666-4666-8666-666666666666',
      }),
    );

    service.list.mockClear();
    await request(app.getHttpServer())
      .get('/master-data/airports?countryId=not-a-uuid')
      .expect(400);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('rejects pagination outside the allowlist before the service', async () => {
    await request(app.getHttpServer())
      .get('/master-data/countries?pageSize=500')
      .expect(400);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('requires a values object for mutations', async () => {
    await request(app.getHttpServer())
      .post('/master-data/countries')
      .send({ code: 'IR' })
      .expect(400);
    expect(service.create).not.toHaveBeenCalled();
  });
  it('forbids generic exchange-rate update and status before the service', async () => {
    await request(app.getHttpServer())
      .patch('/master-data/exchange-rates/44444444-4444-4444-8444-444444444444')
      .send({ values: { rate: '610000' }, version: 1 })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('CURRENCY_RATE_STATUS_TRANSITION_FORBIDDEN'),
      );
    await request(app.getHttpServer())
      .patch(
        '/master-data/exchange-rates/44444444-4444-4444-8444-444444444444/status',
      )
      .send({ status: 'active', version: 1 })
      .expect(409)
      .expect(({ body }) =>
        expect(body.code).toBe('CURRENCY_RATE_STATUS_TRANSITION_FORBIDDEN'),
      );
    expect(service.update).not.toHaveBeenCalled();
    expect(service.status).not.toHaveBeenCalled();
  });
});
