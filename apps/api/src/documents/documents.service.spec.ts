import { Readable } from 'node:stream';

import type { AuthenticatedActor } from '@rubi/contracts';
import {
  ConflictException,
  ForbiddenException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentUploadDto } from './documents.dto';
import type {
  DocumentDetailRow,
  DocumentsRepository,
} from './documents.repository';
import { allowedDocumentDomains } from './documents.repository';
import { DocumentsService } from './documents.service';
import type { DocumentsScanProcessor } from './documents.scan-processor';
import type { LocalDocumentStorage } from './documents.storage';

const branchId = '33333333-3333-4333-8333-333333333333';
const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: [branchId],
  permissions: [
    'documents.list',
    'documents.metadata.read',
    'documents.upload',
    'documents.sales.read',
  ],
};

function row(
  overrides: Partial<{
    confidentiality: DocumentDetailRow['confidentiality'];
    domain: DocumentDetailRow['documentType']['domain'];
    mimeType: string;
    scanStatus: NonNullable<DocumentDetailRow['currentVersion']>['scanStatus'];
  }> = {},
): DocumentDetailRow {
  const now = new Date('2026-09-01T08:00:00.000Z');
  const version = {
    id: '77777777-7777-4777-8777-777777777777',
    documentId: '44444444-4444-4444-8444-444444444444',
    versionNumber: 1,
    storageObjectKey:
      'documents/44444444-4444-4444-8444-444444444444/v1/88888888-8888-4888-8888-888888888888.bin',
    originalFileName: 'contract.pdf',
    safeDownloadName: 'contract.pdf',
    detectedMimeType: overrides.mimeType ?? 'application/pdf',
    extension: overrides.mimeType === 'image/jpeg' ? 'jpg' : 'pdf',
    sizeBytes: 12n,
    sha256: 'a'.repeat(64),
    scanStatus: overrides.scanStatus ?? 'AWAITING_ANTIVIRUS_ADAPTER',
    versionNote: 'بارگذاری اولیه',
    createdByUserId: actor.userId,
    createdAt: now,
    createdBy: { id: actor.userId, displayName: 'کارشناس فروش' },
  };
  return {
    id: '44444444-4444-4444-8444-444444444444',
    archiveCode: 'DOC-20260901-ABC123',
    title: 'قرارداد محرمانه',
    description: 'شرح محرمانه',
    documentTypeId: '55555555-5555-4555-8555-555555555555',
    categoryId: '66666666-6666-4666-8666-666666666666',
    branchId,
    ownerUserId: actor.userId,
    sourceModule: 'sales',
    sourceEntityType: 'contract',
    sourceEntityId: 'SALES-REAL-42',
    confidentiality: overrides.confidentiality ?? 'CONFIDENTIAL',
    archiveStatus: 'ACTIVE',
    validUntil: null,
    currentVersionNumber: 1,
    currentVersionId: version.id,
    version: 1,
    legalHoldActive: false,
    proposedDeletionAt: null,
    archivedAt: null,
    deletedAt: null,
    createdByUserId: actor.userId,
    updatedByUserId: actor.userId,
    createdAt: now,
    updatedAt: now,
    documentType: {
      id: '55555555-5555-4555-8555-555555555555',
      code: 'SALES_CONTRACT',
      name: 'قرارداد فروش',
      domain: overrides.domain ?? 'SALES',
    },
    category: {
      id: '66666666-6666-4666-8666-666666666666',
      code: 'CONTRACTS',
      name: 'قراردادها',
    },
    owner: { id: actor.userId, displayName: 'کارشناس فروش' },
    currentVersion: version,
    versions: [version],
    relations: [
      {
        id: '99999999-9999-4999-8999-999999999999',
        documentId: '44444444-4444-4444-8444-444444444444',
        relationType: 'PRIMARY_CASE',
        sourceModule: 'sales',
        sourceEntityType: 'contract',
        sourceEntityId: 'SALES-REAL-42',
        displayLabel: 'قرارداد فروش ۴۲',
        createdAt: now,
      },
    ],
  } as DocumentDetailRow;
}

describe('DocumentsService security and persistence flow', () => {
  const repository = {
    list: vi.fn(),
    options: vi.fn(),
    findDetail: vi.fn(),
    uploadReferences: vi.fn(),
    createUploaded: vi.fn(),
    appendAudit: vi.fn(),
    audit: vi.fn(),
  };
  const storage = {
    putQuarantined: vi.fn(),
    removeQuarantined: vi.fn(),
    openQuarantined: vi.fn(),
  };
  const scanProcessor = {
    available: true,
    processVersion: vi.fn().mockResolvedValue(false),
  };
  let service: DocumentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentsService(
      repository as unknown as DocumentsRepository,
      storage as unknown as LocalDocumentStorage,
      scanProcessor as unknown as DocumentsScanProcessor,
    );
  });

  it('derives allowed domains only from exact IAM permissions', () => {
    expect(allowedDocumentDomains(actor.permissions)).toEqual([
      'GENERAL',
      'SALES',
    ]);
    expect(allowedDocumentDomains(actor.permissions)).not.toContain('FINANCE');
    expect(allowedDocumentDomains(actor.permissions)).not.toContain(
      'HUMAN_RESOURCES',
    );
  });

  it('returns upload options with the authenticated user and allowed branches', async () => {
    repository.options.mockResolvedValue({
      documentTypes: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          code: 'SALES_CONTRACT',
          name: 'قرارداد فروش',
          domain: 'SALES',
          defaultConfidentiality: 'INTERNAL',
          allowedMimeTypes: ['application/pdf'],
          maxFileSizeBytes: 1_000_000n,
          requiresExpiry: false,
        },
      ],
      categories: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          code: 'CONTRACTS',
          name: 'قراردادها',
        },
      ],
      owners: [{ id: actor.userId, displayName: 'کارشناس فروش' }],
      branches: [{ id: branchId, code: 'TEH', name: 'شعبه تهران' }],
    });

    const result = await service.options(actor);

    expect(repository.options).toHaveBeenCalledWith(
      [branchId],
      ['GENERAL', 'SALES'],
    );
    expect(result.data).toMatchObject({
      currentUserId: actor.userId,
      branches: [{ id: branchId, code: 'TEH', name: 'شعبه تهران' }],
    });
  });

  it('applies branch/domain scope server-side and masks sensitive list metadata', async () => {
    repository.list.mockResolvedValue({ rows: [row()], total: 1 });

    const result = await service.list({ page: 1, pageSize: 25 }, actor);

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 25 }),
      [branchId],
      ['GENERAL', 'SALES'],
      actor.userId,
    );
    expect(result.data[0]).toMatchObject({
      title: 'سند محرمانه ••••••',
      description: null,
    });
  });

  it('reports sensitive file capabilities from the effective read permissions', async () => {
    repository.findDetail.mockResolvedValue(row());
    repository.appendAudit.mockResolvedValue({});

    const denied = await service.detail(
      row().id,
      {
        ...actor,
        permissions: [...actor.permissions, 'documents.file.read'],
      },
      {},
    );
    const allowed = await service.detail(
      row().id,
      {
        ...actor,
        permissions: [
          ...actor.permissions,
          'documents.file.read',
          'documents.sensitive.read',
        ],
      },
      {},
    );

    expect(denied.data.capabilities.viewFile).toBe(false);
    expect(allowed.data.capabilities.viewFile).toBe(true);
  });

  it('stores a valid upload under an opaque key and records it as quarantined', async () => {
    repository.uploadReferences.mockResolvedValue({
      documentType: {
        id: '55555555-5555-4555-8555-555555555555',
        domain: 'SALES',
        defaultConfidentiality: 'INTERNAL',
        allowedMimeTypes: ['application/pdf'],
        maxFileSizeBytes: 25 * 1024 * 1024,
        requiresExpiry: false,
      },
      category: { id: '66666666-6666-4666-8666-666666666666' },
      owner: { id: actor.userId },
      branch: { id: branchId },
    });
    repository.createUploaded.mockResolvedValue(
      row({ confidentiality: 'INTERNAL' }),
    );
    const dto = {
      title: 'قرارداد واقعی',
      documentTypeId: '55555555-5555-4555-8555-555555555555',
      categoryId: '66666666-6666-4666-8666-666666666666',
      branchId,
      ownerUserId: actor.userId,
      sourceModule: 'sales',
      sourceEntityType: 'contract',
      sourceEntityId: 'SALES-42',
      sourceDisplayLabel: 'قرارداد فروش ۴۲',
    } satisfies DocumentUploadDto;
    const buffer = Buffer.from('%PDF-1.7\nreal synthetic test bytes');

    const result = await service.upload(
      dto,
      {
        buffer,
        mimetype: 'application/pdf',
        originalname: 'contract.pdf',
        size: buffer.length,
      },
      actor,
      { ipAddress: '192.0.2.44', userAgent: 'vitest' },
    );

    expect(storage.putQuarantined).toHaveBeenCalledWith(
      expect.stringMatching(
        /^documents\/[0-9a-f-]{36}\/v1\/[0-9a-f-]{36}\.bin$/,
      ),
      buffer,
    );
    expect(repository.createUploaded).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'قرارداد واقعی',
        detectedMimeType: 'application/pdf',
        ipSummary: '192.0.2.x',
      }),
    );
    expect(result.data.currentVersion.scanStatus).toBe(
      'AWAITING_ANTIVIRUS_ADAPTER',
    );
  });

  it('fails closed for an unscanned download and appends a denial audit', async () => {
    repository.findDetail.mockResolvedValue(row());
    repository.appendAudit.mockResolvedValue({});

    await expect(
      service.download(row().id, actor, { ipAddress: '192.0.2.44' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'documents.download',
        outcome: 'FAILURE',
        reason: 'DOWNLOAD_POLICY_DENIED',
      }),
    );
    expect(storage.openQuarantined).not.toHaveBeenCalled();
  });

  it('streams a clean image preview with sensitive-read reason and its own audit action', async () => {
    const previewActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.file.read',
        'documents.sensitive.read',
      ],
    };
    repository.findDetail.mockResolvedValue(
      row({ mimeType: 'image/jpeg', scanStatus: 'CLEAN' }),
    );
    repository.appendAudit.mockResolvedValue({});
    storage.openQuarantined.mockResolvedValue(
      Readable.from(Buffer.from([0xff, 0xd8, 0xff, 0xd9])),
    );

    const result = await service.preview(row().id, previewActor, {
      ipAddress: '192.0.2.44',
      sensitiveReason: 'بررسی پرونده',
    });

    expect(result.mimeType).toBe('image/jpeg');
    expect(repository.appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'documents.file.preview',
        outcome: 'SUCCESS',
        reason: 'بررسی پرونده',
      }),
    );
    expect(storage.openQuarantined).toHaveBeenCalledOnce();
  });

  it('does not stream a clean non-image through the preview endpoint', async () => {
    const previewActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.file.read',
        'documents.sensitive.read',
      ],
    };
    repository.findDetail.mockResolvedValue(
      row({ mimeType: 'application/pdf', scanStatus: 'CLEAN' }),
    );
    repository.appendAudit.mockResolvedValue({});

    await expect(
      service.preview(row().id, previewActor, {
        sensitiveReason: 'بررسی پرونده',
      }),
    ).rejects.toBeInstanceOf(UnsupportedMediaTypeException);
    expect(repository.appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'documents.file.preview',
        outcome: 'FAILURE',
        reason: 'PREVIEW_TYPE_UNSUPPORTED',
      }),
    );
    expect(storage.openQuarantined).not.toHaveBeenCalled();
  });

  it('fails closed when an image preview has not passed its security scan', async () => {
    const previewActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.file.read',
        'documents.sensitive.read',
      ],
    };
    repository.findDetail.mockResolvedValue(
      row({ mimeType: 'image/jpeg', scanStatus: 'PENDING_SCAN' }),
    );
    repository.appendAudit.mockResolvedValue({});

    await expect(
      service.preview(row().id, previewActor, {
        sensitiveReason: 'بررسی پرونده',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(repository.appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'FAILURE',
        reason: 'PREVIEW_SCAN_BLOCKED',
      }),
    );
    expect(storage.openQuarantined).not.toHaveBeenCalled();
  });

  it('requires a meaningful reason before previewing a sensitive image', async () => {
    const previewActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.file.read',
        'documents.sensitive.read',
      ],
    };
    repository.findDetail.mockResolvedValue(
      row({ mimeType: 'image/jpeg', scanStatus: 'CLEAN' }),
    );
    repository.appendAudit.mockResolvedValue({});

    await expect(
      service.preview(row().id, previewActor, { sensitiveReason: 'کم' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'FAILURE',
        reason: 'PREVIEW_POLICY_DENIED',
      }),
    );
    expect(storage.openQuarantined).not.toHaveBeenCalled();
  });
});
