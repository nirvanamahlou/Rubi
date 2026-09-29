import {
  Body,
  Controller,
  Post,
  ValidationPipe,
  type CanActivate,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Type } from 'class-transformer';
import { IsString, ValidateNested } from 'class-validator';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../src/iam/auth.guard';
import { PermissionGuard } from '../src/iam/permission.guard';
import {
  CurrencyRateController,
  MasterDataAuditController,
} from '../src/master-data/currency-rate.controller';
import { CurrencyRateService } from '../src/master-data/currency-rate.service';
import { HotelImportController } from '../src/master-data/hotel-import.controller';
import { HOTEL_IMPORT_MIME } from '../src/master-data/hotel-import.parser';
import { HotelImportService } from '../src/master-data/hotel-import.service';

class NestedValueDto {
  @IsString()
  code!: string;
}

class NestedEnvelopeDto {
  @ValidateNested()
  @Type(() => NestedValueDto)
  item!: NestedValueDto;
}

@Controller('validation')
class NestedValidationController {
  @Post('nested')
  validate(@Body() dto: NestedEnvelopeDto) {
    return dto;
  }
}

describe('Master Data runtime DTO validation', () => {
  let app: INestApplication;
  const hotelService = {
    preview: vi.fn(),
    commit: vi.fn(),
  };
  const currencyService = {
    history: vi.fn(),
    current: vi.fn(),
    decide: vi.fn(),
    audit: vi.fn(),
  };
  const actor = {
    userId: '11111111-1111-4111-8111-111111111111',
    sessionId: '22222222-2222-4222-8222-222222222222',
    permissions: ['master_data.import', 'master_data.currency_rate.approve'],
    branchIds: ['33333333-3333-4333-8333-333333333333'],
  };
  const authGuard: CanActivate = {
    canActivate(context: ExecutionContext) {
      context.switchToHttp().getRequest().actor = actor;
      return true;
    },
  };

  beforeEach(async () => {
    hotelService.preview.mockResolvedValue({ data: { sessionId: 'preview' } });
    hotelService.commit.mockResolvedValue({ data: { status: 'COMPLETED' } });
    currencyService.decide.mockResolvedValue({ data: { status: 'APPROVED' } });
    const module = await Test.createTestingModule({
      controllers: [
        HotelImportController,
        CurrencyRateController,
        MasterDataAuditController,
        NestedValidationController,
      ],
      providers: [
        { provide: HotelImportService, useValue: hotelService },
        { provide: CurrencyRateService, useValue: currencyService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuard)
      .overrideGuard(PermissionGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('passes valid preview and commit DTOs to the service', async () => {
    await request(app.getHttpServer())
      .post('/master-data/hotel-imports/preview')
      .field('countryId', '44444444-4444-4444-8444-444444444444')
      .field('cityId', '55555555-5555-4555-8555-555555555555')
      .field('templateVersion', 'HOTEL_IMPORT_V1')
      .attach('file', Buffer.from('PK\u0003\u0004fixture'), {
        filename: 'hotels.xlsx',
        contentType: HOTEL_IMPORT_MIME,
      })
      .expect(201);
    expect(hotelService.preview).toHaveBeenCalledWith(
      expect.objectContaining({ originalname: 'hotels.xlsx' }),
      expect.objectContaining({
        countryId: '44444444-4444-4444-8444-444444444444',
        cityId: '55555555-5555-4555-8555-555555555555',
        templateVersion: 'HOTEL_IMPORT_V1',
      }),
      actor,
      undefined,
      undefined,
    );

    await request(app.getHttpServer())
      .post(
        '/master-data/hotel-imports/66666666-6666-4666-8666-666666666666/commit',
      )
      .send({
        previewToken: 'valid-preview-token',
        idempotencyKey: 'valid-idempotency-key',
        duplicateBehavior: 'SKIP',
        createMissingReferences: true,
      })
      .expect(201);
    expect(hotelService.commit).toHaveBeenCalledWith(
      '66666666-6666-4666-8666-666666666666',
      expect.objectContaining({
        duplicateBehavior: 'SKIP',
        createMissingReferences: true,
      }),
      actor,
      undefined,
      undefined,
    );
  });

  it('passes valid approve and reject DTOs to the service', async () => {
    for (const decision of ['approve', 'reject'] as const) {
      await request(app.getHttpServer())
        .patch(
          `/master-data/currency-rates/77777777-7777-4777-8777-777777777777/${decision}`,
        )
        .send({ expectedVersion: 1, reason: 'reviewed by checker' })
        .expect(200);
    }
    expect(currencyService.decide).toHaveBeenNthCalledWith(
      1,
      '77777777-7777-4777-8777-777777777777',
      1,
      'reviewed by checker',
      'approve',
      actor,
      undefined,
    );
    expect(currencyService.decide).toHaveBeenNthCalledWith(
      2,
      '77777777-7777-4777-8777-777777777777',
      1,
      'reviewed by checker',
      'reject',
      actor,
      undefined,
    );
  });

  it('rejects unknown, missing and invalid enum fields before services', async () => {
    await request(app.getHttpServer())
      .post('/master-data/hotel-imports/preview')
      .field('countryId', '44444444-4444-4444-8444-444444444444')
      .field('cityId', '55555555-5555-4555-8555-555555555555')
      .field('templateVersion', 'HOTEL_IMPORT_V1')
      .field('unknown', 'blocked')
      .attach('file', Buffer.from('PK\u0003\u0004fixture'), {
        filename: 'hotels.xlsx',
        contentType: HOTEL_IMPORT_MIME,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(
        '/master-data/hotel-imports/66666666-6666-4666-8666-666666666666/commit',
      )
      .send({
        previewToken: 'valid-preview-token',
        idempotencyKey: 'valid-idempotency-key',
        createMissingReferences: true,
      })
      .expect(400);

    await request(app.getHttpServer())
      .post(
        '/master-data/hotel-imports/66666666-6666-4666-8666-666666666666/commit',
      )
      .send({
        previewToken: 'valid-preview-token',
        idempotencyKey: 'valid-idempotency-key',
        duplicateBehavior: 'OVERWRITE',
        createMissingReferences: true,
      })
      .expect(400);
    expect(hotelService.commit).not.toHaveBeenCalled();
  });

  it('accepts valid nested DTOs and rejects nested unknown fields', async () => {
    await request(app.getHttpServer())
      .post('/validation/nested')
      .send({ item: { code: 'VALID' } })
      .expect(201)
      .expect({ item: { code: 'VALID' } });

    await request(app.getHttpServer())
      .post('/validation/nested')
      .send({ item: { code: 'VALID', unknown: 'blocked' } })
      .expect(400);
  });
});
