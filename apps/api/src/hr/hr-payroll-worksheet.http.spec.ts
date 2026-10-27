import 'reflect-metadata';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { AuthGuard } from '../iam/auth.guard';
import { configureApplication } from '../configure-application';
import { HrPayrollWorksheetController } from './hr-payroll-worksheet.controller';
import { HrPayrollWorksheetService } from './hr-payroll-worksheet.service';

describe('bounded payroll HTTP transport', () => {
  let app: INestApplication;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [HrPayrollWorksheetController],
      providers: [
        {
          provide: HrPayrollWorksheetService,
          useValue: {
            update: (_id: string, body: { snapshot: { rows: unknown[] } }) => ({
              count: body.snapshot.rows.length,
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            API_PREFIX: 'api',
            CORS_ORIGINS: 'http://localhost:3100',
            ENABLE_SWAGGER: false,
          }),
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('accepts a worksheet above the default parser size without broadening other paths', async () => {
    const body = {
      version: 1,
      snapshot: {
        rows: Array.from({ length: 500 }, () => ({
          name: 'Synthetic '.repeat(30),
          account: 'TEST-ONLY',
        })),
      },
    };
    expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(100 * 1024);
    const response = await request(app.getHttpServer())
      .patch('/api/hr/payroll-worksheets/00000000-0000-4000-8000-000000000001')
      .send(body);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ count: 500 });
    expect(
      (await request(app.getHttpServer()).post('/api/unrelated').send(body))
        .status,
    ).toBe(413);
  });
});
