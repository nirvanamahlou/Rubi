import 'reflect-metadata';
import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ReservationRequestsController } from './reservations-runtime.module';
import {
  ReservationPassengerFilesController,
  ReservationPassengerFilesService,
} from './reservation-passenger-files';
import { ReservationsPublicService } from './reservations-public.service';
import { ReservationHotelPurchaseService } from './reservation-hotel-purchase.service';
import { ReservationServicePurchaseService } from './reservation-service-purchase.service';
import { TravelWorkflowService } from './travel-workflow.service';
import { ReservationOperationInterceptor } from './reservation-operation.interceptor';
import { FinanceDeliveryService } from '../finance/document-delivery/finance-delivery.module';
import { CustomerService } from '../customers/customer.service';
import { IamService } from '../iam/iam.service';
const id = '11111111-1111-4111-8111-111111111111';
describe('reservation summary and mutation HTTP boundary', () => {
  let app: INestApplication, permissions: string[], branches: string[];
  const identity = vi.fn().mockResolvedValue({ data: { ok: true } });
  const record = vi.fn().mockResolvedValue(undefined),
    financeRead = vi.fn().mockResolvedValue({
      approved: true,
      updatedAt: '2026-09-29T08:00:00.000Z',
      updatedByUserId: 'finance',
      reason: 'never-expose',
    });
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [
        ReservationRequestsController,
        ReservationPassengerFilesController,
      ],
      providers: [
        ReservationOperationInterceptor,
        {
          provide: ReservationsPublicService,
          useValue: { lastRecordedOperation: async () => null },
        },
        { provide: ReservationHotelPurchaseService, useValue: {} },
        { provide: ReservationServicePurchaseService, useValue: {} },
        { provide: ReservationPassengerFilesService, useValue: { identity } },
        {
          provide: TravelWorkflowService,
          useValue: {
            detail: async (_id: string, scope: string[]) => {
              if (!scope.includes('allowed')) throw new NotFoundException();
              return { branchId: 'allowed' };
            },
          },
        },
        { provide: FinanceDeliveryService, useValue: { read: financeRead } },
        { provide: CustomerService, useValue: {} },
        {
          provide: IamService,
          useValue: {
            authenticate: async () => ({
              userId: 'operator',
              sessionId: 'session',
              permissions,
              branchIds: branches,
            }),
            assertPermissions: IamService.prototype.assertPermissions,
            latestReservationOperation: async () => null,
            reservationResponsibilityNames: async () =>
              new Map([['finance', 'Financial responsible']]),
            recordReservationOperation: record,
          },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  beforeEach(() => {
    permissions = [
      'reservations.read',
      'customers.read',
      'customers.update',
      'customers.sensitive.read',
    ];
    branches = ['allowed'];
    vi.clearAllMocks();
  });
  afterAll(async () => {
    await app?.close();
  });
  const get = () =>
    request(app.getHttpServer())
      .get(`/reservations/requests/${id}/operation-summary`)
      .set('Cookie', 'nora_access=allowed');
  const patch = () =>
    request(app.getHttpServer())
      .patch(
        `/reservations/requests/${id}/passengers/22222222-2222-4222-8222-222222222222/identity`,
      )
      .set('Cookie', 'nora_access=allowed')
      .send({ passport: 'never-copy' });
  it('returns authorized responsibility without finance reason or general user access', async () => {
    const result = await get().expect(200);
    expect(result.headers['cache-control']).toContain('no-store');
    expect(result.body.data.delivery.actorName).toBe('Financial responsible');
    expect(JSON.stringify(result.body)).not.toContain('never-expose');
  });
  it('rejects anonymous, denied and other-branch reads before Finance data', async () => {
    await request(app.getHttpServer())
      .get(`/reservations/requests/${id}/operation-summary`)
      .expect(401);
    permissions = [];
    await get().expect(403);
    permissions = ['reservations.read'];
    branches = ['other'];
    await get().expect(404);
    expect(financeRead).not.toHaveBeenCalled();
  });
  it('registers the real authenticated actor only after passenger mutation succeeds', async () => {
    await patch().expect(200);
    expect(identity).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledWith(
      id,
      'allowed',
      expect.objectContaining({ userId: 'operator' }),
      'reservations.identity',
    );
    expect(JSON.stringify(record.mock.calls)).not.toContain('never-copy');
  });
  it('does not execute or track unauthorized/out-of-branch passenger mutations', async () => {
    permissions = ['reservations.read'];
    await patch().expect(403);
    permissions = [
      'reservations.read',
      'customers.read',
      'customers.update',
      'customers.sensitive.read',
    ];
    branches = ['other'];
    await patch().expect(404);
    expect(identity).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });
});
