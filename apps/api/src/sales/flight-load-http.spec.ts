import 'reflect-metadata';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { FlightLoadController } from './flight-load.controller';
import {
  FlightLoadService,
  emptyFlightComposition,
} from './flight-load.service';
import { IamService } from '../iam/iam.service';
const id = '11111111-1111-4111-8111-111111111111';
let app: INestApplication;
const contracts = vi.fn().mockResolvedValue({
  version: 1,
  offerId: id,
  data: [],
  totals: { ...emptyFlightComposition(), contracts: 0 },
});
beforeAll(async () => {
  const module = await Test.createTestingModule({
    controllers: [FlightLoadController],
    providers: [
      { provide: FlightLoadService, useValue: { contracts } },
      {
        provide: IamService,
        useValue: {
          authenticate: async (token: string) => ({
            userId: 'u',
            branchIds: ['b'],
            permissions: token === 'export' ? ['sales.export'] : [],
          }),
        },
      },
    ],
  }).compile();
  app = module.createNestApplication();
  await app.init();
});
afterAll(async () => {
  await app?.close();
});
it('requires a session and validates the exact offer UUID and cancellation filter', async () => {
  await request(app.getHttpServer())
    .get(`/sales/flight-load/${id}/contracts`)
    .expect(401);
  await request(app.getHttpServer())
    .get('/sales/flight-load/not-a-uuid/contracts')
    .set('Cookie', 'nora_access=view')
    .expect(400);
  await request(app.getHttpServer())
    .get(`/sales/flight-load/${id}/contracts?cancelled=invalid`)
    .set('Cookie', 'nora_access=view')
    .expect(400);
});
it('returns a private read-only report with parsed filter', async () => {
  const result = await request(app.getHttpServer())
    .get(`/sales/flight-load/${id}/contracts?cancelled=true`)
    .set('Cookie', 'nora_access=view')
    .expect(200);
  expect(result.headers['cache-control']).toBe('private, no-store');
  expect(contracts.mock.calls.at(-1)?.[2]).toBe(true);
  expect(result.body.offerId).toBe(id);
});
it('requires existing export permission and produces a real private XLSX attachment', async () => {
  const path = `/sales/flight-load/${id}/contracts.xlsx`;
  await request(app.getHttpServer())
    .get(path)
    .set('Cookie', 'nora_access=view')
    .expect(403);
  const result = await request(app.getHttpServer())
    .get(path)
    .set('Cookie', 'nora_access=export')
    .expect(200);
  expect(result.headers['content-type']).toContain('spreadsheetml.sheet');
  expect(result.headers['content-disposition']).toContain(id + '.xlsx');
  expect(result.headers['cache-control']).toBe('private, no-store');
});
