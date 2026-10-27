import 'reflect-metadata';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  ConflictException,
  type INestApplication,
  type ExecutionContext,
} from '@nestjs/common';
import { Readable } from 'node:stream';
import request from 'supertest';
import type { AuthenticatedActor } from '@nora/contracts';
import { AuthGuard } from '../iam/auth.guard';
import { DocumentsService } from '../documents/documents.service';
import { SalesService } from './sales.service';
import {
  SalesPaymentReceiptsController,
  SalesPaymentReceiptsService,
} from './sales-payment-receipts';
const id = '10000000-0000-4000-8000-000000000001',
  paymentId = '10000000-0000-4000-8000-000000000002',
  documentId = '10000000-0000-4000-8000-000000000003';
const actor = {
  userId: 'reader',
  branchIds: ['branch'],
  permissions: ['sales.contracts.read.branch'],
} as unknown as AuthenticatedActor;
const upload = vi.fn(async (...args: unknown[]) => {
  void args;
  return {
    data: { id: documentId, currentVersion: { scanStatus: 'PENDING_SCAN' } },
  };
});
const download = vi.fn(async (...args: unknown[]) => {
  void args;
  return {
    stream: Readable.from(Buffer.from('%PDF-1.4')),
    mimeType: 'application/pdf',
    sizeBytes: 8,
    fileName: 'receipt.pdf',
  };
});
let app: INestApplication;
beforeAll(async () => {
  const sales = Object.assign(Object.create(SalesService.prototype), {
    repository: {
      findById: vi.fn(async () => ({
        branchId: 'branch',
        ownerUserId: 'reader',
        contractNumber: 'SYNTHETIC',
        payments: [{ id: paymentId, dueAt: new Date('2099-01-01') }],
      })),
    },
  }) as SalesService;
  const module = await Test.createTestingModule({
    controllers: [SalesPaymentReceiptsController],
    providers: [
      SalesPaymentReceiptsService,
      { provide: SalesService, useValue: sales },
      {
        provide: DocumentsService,
        useValue: {
          options: async () => ({
            data: {
              currentUserId: 'reader',
              branches: [{ id: 'branch' }],
              owners: [{ id: 'reader' }],
              organizationBranches: [],
              documentTypes: [
                {
                  id: 'type',
                  code: 'RECEIPT',
                  domain: 'FINANCE',
                  requiresExpiry: false,
                },
              ],
              categories: [{ id: 'category', code: 'PROCUREMENT_FINANCE' }],
            },
          }),
          upload,
          download,
          list: async () => ({ data: [], meta: { total: 0 } }),
        },
      },
    ],
  })
    .overrideGuard(AuthGuard)
    .useValue({
      canActivate(context: ExecutionContext) {
        const req = context.switchToHttp().getRequest<{
          headers: Record<string, string>;
          actor: AuthenticatedActor;
        }>();
        if (!req.headers['x-reader']) return false;
        req.actor =
          req.headers['x-reader'] === 'foreign'
            ? { ...actor, branchIds: ['elsewhere'] }
            : actor;
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
const url = `/sales/contracts/${id}/payments/${paymentId}/receipts`;
it('accepts multipart receipts for a contract reader without Documents privileges', async () => {
  const response = await request(app.getHttpServer())
    .post(url)
    .set('x-reader', 'reader')
    .field('branchId', 'forged')
    .field('ownerUserId', 'forged')
    .attach('file', Buffer.from('%PDF-1.4'), {
      filename: 'receipt.pdf',
      contentType: 'application/pdf',
    });
  expect(response.status).toBe(201);
  expect(response.body.data.id).toBe(documentId);
  expect(upload).toHaveBeenLastCalledWith(
    expect.objectContaining({
      branchId: 'branch',
      ownerUserId: 'reader',
      sourceEntityId: paymentId,
    }),
    expect.objectContaining({ originalname: 'receipt.pdf' }),
    expect.anything(),
    expect.anything(),
  );
});
it('downloads through the exact authorized payment source and keeps the scan guard', async () => {
  const response = await request(app.getHttpServer())
    .get(`${url}/${documentId}/download`)
    .set('x-reader', 'reader');
  expect(response.status).toBe(200);
  expect(response.headers['content-disposition']).toContain('attachment;');
  expect(response.headers['cache-control']).toBe('private, no-store');
  expect(download.mock.calls.at(-1)?.[3]).toEqual({
    sourceModule: 'sales',
    sourceEntityType: 'SalesContractPaymentEntry',
    sourceEntityId: paymentId,
  });
  download.mockRejectedValueOnce(
    new ConflictException('Synthetic scan pending'),
  );
  expect(
    (
      await request(app.getHttpServer())
        .get(`${url}/${documentId}/download`)
        .set('x-reader', 'reader')
    ).status,
  ).toBe(409);
});
it('rejects unauthenticated, foreign branch, foreign payment and unsupported file requests', async () => {
  expect((await request(app.getHttpServer()).get(url)).status).toBe(403);
  expect(
    (await request(app.getHttpServer()).get(url).set('x-reader', 'foreign'))
      .status,
  ).toBe(403);
  expect(
    (
      await request(app.getHttpServer())
        .get(url.replace(paymentId, documentId))
        .set('x-reader', 'reader')
    ).status,
  ).toBe(404);
  expect(
    (
      await request(app.getHttpServer())
        .post(url)
        .set('x-reader', 'reader')
        .attach('file', Buffer.from('<svg/>'), {
          filename: 'unsafe.svg',
          contentType: 'image/svg+xml',
        })
    ).status,
  ).toBe(400);
});
