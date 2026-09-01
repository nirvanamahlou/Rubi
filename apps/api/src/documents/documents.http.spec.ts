import { Readable } from 'node:stream';

import { ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedActor } from '@rubi/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import { PermissionGuard } from '../iam/permission.guard';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

const branchId = '33333333-3333-4333-8333-333333333333';
const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: [branchId],
  permissions: [
    'documents.list',
    'documents.metadata.read',
    'documents.file.read',
    'documents.download',
    'documents.upload',
    'documents.audit.read',
    'documents.sales.read',
  ],
};

describe('Documents HTTP boundary', () => {
  let app: INestApplication;
  const service = {
    list: vi.fn().mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 25, total: 0, totalPages: 1 },
    }),
    options: vi.fn().mockResolvedValue({ data: {} }),
    upload: vi.fn().mockResolvedValue({ data: { id: 'document-id' } }),
    detail: vi.fn().mockResolvedValue({ data: { id: 'document-id' } }),
    audit: vi.fn().mockResolvedValue({ data: [] }),
    download: vi.fn().mockResolvedValue({
      stream: Readable.from(Buffer.from('%PDF-test')),
      fileName: 'contract.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 9,
    }),
  };
  const iam = {
    authenticate: vi.fn().mockResolvedValue(actor),
    assertPermissions: vi.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: service },
        AuthGuard,
        PermissionGuard,
        { provide: IamService, useValue: iam },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
    vi.clearAllMocks();
  });

  it('validates and forwards server-side list filters with actor scope', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/documents')
      .query({
        domain: 'SALES',
        categoryId: '66666666-6666-4666-8666-666666666666',
        branchId,
        scanStatus: 'CLEAN',
        createdFrom: '2026-08-01',
        createdTo: '2026-08-31',
        sortBy: 'archiveCode',
        sortDirection: 'asc',
        page: 1,
        pageSize: 25,
      })
      .set('Cookie', 'rubi_access=test')
      .expect(200);

    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'SALES',
        categoryId: '66666666-6666-4666-8666-666666666666',
        branchId,
        scanStatus: 'CLEAN',
        createdFrom: '2026-08-01',
        sortBy: 'archiveCode',
      }),
      actor,
    );
    expect(iam.assertPermissions).toHaveBeenCalledWith(actor, [
      'documents.list',
    ]);
  });

  it('rejects invalid list values before reaching the service', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/documents')
      .query({ domain: 'PAYROLL', pageSize: 1000 })
      .set('Cookie', 'rubi_access=test')
      .expect(400);
    expect(service.list).not.toHaveBeenCalled();
  });

  it('accepts a multipart file and validated ownership/source metadata', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/documents/upload')
      .set('Cookie', 'rubi_access=test')
      .field('title', 'قرارداد فروش')
      .field('documentTypeId', '55555555-5555-4555-8555-555555555555')
      .field('categoryId', '66666666-6666-4666-8666-666666666666')
      .field('branchId', branchId)
      .field('ownerUserId', actor.userId)
      .field('sourceModule', 'sales')
      .field('sourceEntityType', 'contract')
      .field('sourceEntityId', 'SALES-42')
      .field('sourceDisplayLabel', 'قرارداد فروش ۴۲')
      .attach('file', Buffer.from('%PDF-1.7\nhttp test'), {
        filename: 'contract.pdf',
        contentType: 'application/pdf',
      })
      .expect(201);

    expect(service.upload).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'قرارداد فروش', branchId }),
      expect.objectContaining({
        originalname: 'contract.pdf',
        mimetype: 'application/pdf',
      }),
      actor,
      expect.objectContaining({ ipAddress: expect.any(String) }),
    );
  });

  it('requires metadata, file and download permissions at the download route', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/documents/44444444-4444-4444-8444-444444444444/download')
      .set('Cookie', 'rubi_access=test')
      .expect(200);

    expect(iam.assertPermissions).toHaveBeenCalledWith(actor, [
      'documents.metadata.read',
      'documents.file.read',
      'documents.download',
    ]);
  });
});
