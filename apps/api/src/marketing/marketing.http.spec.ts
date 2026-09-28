import { Readable } from 'node:stream';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { AuthenticatedActor } from '@nora/contracts';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGuard } from '../iam/auth.guard';
import { IamService } from '../iam/iam.service';
import { PermissionGuard } from '../iam/permission.guard';
import { DocumentsService } from '../documents/documents.service';
import { DocumentsController } from '../documents/documents.controller';
import { MarketingController } from './marketing.controller';
import { MarketingProcessService } from './marketing-process.service';

const branchId = '11111111-1111-4111-8111-111111111111';
const assetId = '22222222-2222-4222-8222-222222222222';
const actor: AuthenticatedActor = {
  userId: '33333333-3333-4333-8333-333333333333',
  sessionId: 'session',
  branchIds: [branchId],
  permissions: [
    'marketing.read',
    'marketing.process.read',
    'marketing.content.manage',
  ],
};
const asset = {
  documentId: assetId,
  title: 'Brochure',
  scanStatus: 'CLEAN',
  branchId,
};

describe('Marketing HTTP security and content assets', () => {
  let app: INestApplication;
  const documents = {
    listMarketingContentAssets: vi
      .fn()
      .mockResolvedValue({ data: [asset], meta: { total: 1 } }),
    marketingContentAssetOptions: vi
      .fn()
      .mockResolvedValue({ branches: [{ id: branchId }], kinds: ['brochure'] }),
    uploadMarketingContentAsset: vi.fn().mockResolvedValue(asset),
    readMarketingContentAsset: vi.fn().mockResolvedValue(asset),
    downloadMarketingContentAsset: vi.fn().mockResolvedValue({
      stream: Readable.from(Buffer.from('%PDF-test')),
      fileName: 'brochure.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 9,
    }),
  };
  const iam = {
    authenticate: vi.fn().mockResolvedValue(actor),
    assertPermissions: vi.fn(
      (current: AuthenticatedActor, required: string[]) => {
        if (
          required.some(
            (permission) => !current.permissions.includes(permission as never),
          )
        )
          throw new ForbiddenException();
      },
    ),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [MarketingController, DocumentsController],
      providers: [
        { provide: DocumentsService, useValue: documents },
        {
          provide: MarketingProcessService,
          useValue: {
            process: () => ({ persistenceStatus: 'INFRASTRUCTURE_PENDING' }),
          },
        },
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
    await app.close();
    vi.clearAllMocks();
  });

  it('guards the existing process route: 200, 401 and 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/marketing/process')
      .set('Cookie', 'nora_access=test')
      .expect(200);
    await request(app.getHttpServer())
      .get('/api/v1/marketing/process')
      .expect(401);
    iam.authenticate.mockResolvedValueOnce({ ...actor, permissions: [] });
    await request(app.getHttpServer())
      .get('/api/v1/marketing/process')
      .set('Cookie', 'nora_access=test')
      .expect(403);
  });

  it('returns 201 for clean upload, 202 for pending scan, and validates the multipart body', async () => {
    const post = () =>
      request(app.getHttpServer())
        .post('/api/v1/marketing/content/assets')
        .set('Cookie', 'nora_access=test')
        .field('branchId', branchId)
        .field('title', 'Brochure')
        .field('kind', 'brochure')
        .attach('file', Buffer.from('%PDF-test'), {
          filename: 'brochure.pdf',
          contentType: 'application/pdf',
        });
    await post().expect(201);
    documents.uploadMarketingContentAsset.mockResolvedValueOnce({
      ...asset,
      scanStatus: 'PENDING_SCAN',
    });
    await post().expect(202);
    documents.uploadMarketingContentAsset.mockResolvedValueOnce({
      ...asset,
      scanStatus: 'AWAITING_ANTIVIRUS_ADAPTER',
    });
    await post().expect(202);
    for (const scanStatus of ['INFECTED', 'SCAN_FAILED', 'QUARANTINED']) {
      documents.uploadMarketingContentAsset.mockResolvedValueOnce({
        ...asset,
        scanStatus,
      });
      const blocked = await post().expect(409);
      expect(blocked.body).toMatchObject({
        code: 'MARKETING_ASSET_SCAN_BLOCKED',
        data: { documentId: assetId, scanStatus },
      });
    }
    await request(app.getHttpServer())
      .post('/api/v1/marketing/content/assets')
      .set('Cookie', 'nora_access=test')
      .field('branchId', branchId)
      .field('title', 'Brochure')
      .field('kind', 'invalid')
      .attach('file', Buffer.from('%PDF-test'), {
        filename: 'brochure.pdf',
        contentType: 'application/pdf',
      })
      .expect(400);
  });

  it('enforces Marketing permissions and serves scoped list, read and download', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/marketing/content/assets')
      .set('Cookie', 'nora_access=test')
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/marketing/content/assets/${assetId}`)
      .set('Cookie', 'nora_access=test')
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/marketing/content/assets/${assetId}/download`)
      .set('Cookie', 'nora_access=test')
      .expect(200);
    iam.authenticate.mockResolvedValueOnce({
      ...actor,
      permissions: ['marketing.read'],
    });
    await request(app.getHttpServer())
      .post('/api/v1/marketing/content/assets')
      .set('Cookie', 'nora_access=test')
      .expect(403);
    iam.authenticate.mockResolvedValueOnce({ ...actor, permissions: [] });
    await request(app.getHttpServer())
      .get('/api/v1/marketing/content/assets')
      .set('Cookie', 'nora_access=test')
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/documents')
      .set('Cookie', 'nora_access=test')
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/documents/upload')
      .set('Cookie', 'nora_access=test')
      .expect(403);
  });
});
