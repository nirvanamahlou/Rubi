import { Readable } from 'node:stream';
import { createHash, scryptSync } from 'node:crypto';

import type { AuthenticatedActor } from '@nora/contracts';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
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
import type { IamStepUpPort } from '../iam/iam-step-up.port';
import type { HrDirectoryService } from '../hr/hr-directory.service';

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
    archiveStatus: DocumentDetailRow['archiveStatus'];
    confidentiality: DocumentDetailRow['confidentiality'];
    domain: DocumentDetailRow['documentType']['domain'];
    isIncomplete: boolean;
    requiresStepUpVerification: boolean;
    confidentialAccessCodeHash: string | null;
    confidentialAccessCodeSalt: string | null;
    legalHoldActive: boolean;
    mimeType: string;
    requiresExpiry: boolean;
    scanStatus: NonNullable<DocumentDetailRow['currentVersion']>['scanStatus'];
    version: number;
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
    archiveStatus: overrides.archiveStatus ?? 'ACTIVE',
    validUntil: null,
    currentVersionNumber: 1,
    currentVersionId: version.id,
    isIncomplete: overrides.isIncomplete ?? false,
    requiresStepUpVerification: overrides.requiresStepUpVerification ?? false,
    confidentialAccessCodeHash: overrides.confidentialAccessCodeHash ?? null,
    confidentialAccessCodeSalt: overrides.confidentialAccessCodeSalt ?? null,
    confidentialAccessFailedAttempts: 0,
    confidentialAccessLockedUntil: null,
    version: overrides.version ?? 1,
    legalHoldActive: overrides.legalHoldActive ?? false,
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
      requiresExpiry: overrides.requiresExpiry ?? false,
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
    caseOptions: vi.fn(),
    findDetail: vi.fn(),
    findCaseReference: vi.fn(),
    findDetails: vi.fn(),
    uploadReferences: vi.fn(),
    editReferences: vi.fn(),
    updateMetadata: vi.fn(),
    changeArchiveStatus: vi.fn(),
    bulkAction: vi.fn(),
    permanentlyDelete: vi.fn(),
    createUploaded: vi.fn(),
    appendAudit: vi.fn(),
    createAccessGrant: vi.fn(),
    confidentialAccessState: vi.fn(),
    beginConfidentialAccessAttempt: vi.fn(),
    hasConfidentialAccessGrant: vi.fn(),
    consumeAccessGrant: vi.fn(),
    audit: vi.fn(),
    favoriteDocuments: vi.fn(),
    setFavorite: vi.fn(),
  };
  const storage = {
    readQuarantined: vi.fn(),
    putQuarantined: vi.fn(),
    removeQuarantined: vi.fn(),
    openQuarantined: vi.fn(),
  };
  const scanProcessor = {
    available: true,
    processVersion: vi.fn().mockResolvedValue(false),
  };
  const iamStepUp = { verifyStepUp: vi.fn() };
  const hrDirectory = {
    employee: vi.fn(),
    documentBranches: vi.fn().mockResolvedValue([]),
  };
  let service: DocumentsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DocumentsService(
      repository as unknown as DocumentsRepository,
      storage as unknown as LocalDocumentStorage,
      scanProcessor as unknown as DocumentsScanProcessor,
      iamStepUp as unknown as IamStepUpPort,
      hrDirectory as unknown as HrDirectoryService,
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
    hrDirectory.documentBranches.mockResolvedValueOnce([
      { id: 'hr-a', branchId, name: 'نیایش سیر' },
      { id: 'hr-b', branchId, name: 'جهان باستان' },
    ]);
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
      organizationBranches: [
        { id: 'hr-a', branchId, name: 'نیایش سیر' },
        { id: 'hr-b', branchId, name: 'جهان باستان' },
      ],
    });
    expect(hrDirectory.documentBranches).toHaveBeenCalledWith(actor);
  });

  it('applies the published file size and format policy to document options', async () => {
    repository.options.mockResolvedValue({
      documentTypes: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          code: 'SALES_CONTRACT',
          name: 'قرارداد فروش',
          domain: 'SALES',
          defaultConfidentiality: 'INTERNAL',
          allowedMimeTypes: ['application/pdf', 'image/png'],
          maxFileSizeBytes: 20 * 1024 * 1024,
          requiresExpiry: false,
        },
      ],
      categories: [],
      owners: [],
      branches: [{ id: branchId, code: 'TEH', name: 'شعبه تهران' }],
    });
    const settings = {
      json: vi.fn().mockResolvedValue({
        value: { size: 8, types: 'PDF' },
      }),
    };
    const configured = new DocumentsService(
      repository as unknown as DocumentsRepository,
      storage as unknown as LocalDocumentStorage,
      scanProcessor as unknown as DocumentsScanProcessor,
      iamStepUp as unknown as IamStepUpPort,
      hrDirectory as unknown as HrDirectoryService,
      settings as never,
    );

    const result = await configured.options(actor);

    expect(result.data.uploadPolicy).toMatchObject({
      maxFileSizeBytes: 8 * 1024 * 1024,
      allowedMimeTypes: ['application/pdf'],
    });
    expect(settings.json).toHaveBeenCalledWith(
      'documents',
      'upload',
      { branchId },
      {},
    );
  });

  it('uploads a Master Data logo without granting general Documents access to the editor', async () => {
    const masterDataEditor: AuthenticatedActor = {
      ...actor,
      permissions: ['master_data.update'],
    };
    repository.options.mockResolvedValue({
      documentTypes: [
        {
          id: '55555555-5555-4555-8555-555555555555',
          code: 'BRAND_ASSET_TEMPLATE',
          name: 'دارایی برند',
          domain: 'BRAND',
          defaultConfidentiality: 'INTERNAL',
          allowedMimeTypes: ['image/png', 'image/jpeg'],
          maxFileSizeBytes: 5_242_880n,
          requiresExpiry: false,
        },
      ],
      categories: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          code: 'BRAND_ASSETS',
          name: 'دارایی‌های برند',
        },
      ],
      owners: [{ id: actor.userId, displayName: 'ویرایشگر اطلاعات پایه' }],
      branches: [{ id: branchId, code: 'TEH', name: 'شعبه تهران' }],
    });
    repository.list.mockResolvedValue({ rows: [], total: 0 });
    const upload = vi.spyOn(service, 'upload').mockResolvedValue({
      data: {
        id: '44444444-4444-4444-8444-444444444444',
        currentVersion: { scanStatus: 'PENDING_SCAN' },
      },
    } as never);
    const file = {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      mimetype: 'image/png',
      originalname: 'airline.png',
      size: 4,
    };

    const result = await service.uploadMasterDataLogo(
      {
        resource: 'airlines',
        recordId: '77777777-7777-4777-8777-777777777777',
        title: 'لوگوی ایرلاین',
      },
      file,
      masterDataEditor,
      {},
    );

    expect(repository.options).toHaveBeenCalledWith([branchId], ['BRAND']);
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceModule: 'master-data',
        sourceEntityType: 'airlines',
        sourceEntityId: '77777777-7777-4777-8777-777777777777',
      }),
      file,
      expect.objectContaining({
        permissions: expect.arrayContaining([
          'master_data.update',
          'documents.brand.read',
        ]),
      }),
      {},
    );
    expect(masterDataEditor.permissions).toEqual(['master_data.update']);
    expect(result).toMatchObject({
      id: '44444444-4444-4444-8444-444444444444',
      reused: false,
      scanStatus: 'PENDING_SCAN',
    });
  });

  it.each(['available', 'missing', 'corrupt'] as const)(
    'handles %s duplicate logo storage without reusing missing bytes',
    async (state) => {
      const file = {
        buffer: Buffer.from('logo'),
        size: 4,
        mimetype: 'image/png',
        originalname: 'logo.png',
      };
      const bytes = createHash('sha256')
        .update(file.buffer)
        .digest()
        .subarray(0, 16);
      bytes[6] = (bytes[6]! & 0x0f) | 0x50;
      bytes[8] = (bytes[8]! & 0x3f) | 0x80;
      const token = bytes.toString('hex');
      const duplicate = row({
        domain: 'BRAND',
        confidentiality: 'INTERNAL',
        mimeType: 'image/png',
        scanStatus: 'CLEAN',
      });
      duplicate.currentVersion!.versionNote = `master-data-logo-v1:${token.slice(0, 8)}-${token.slice(8, 12)}-${token.slice(12, 16)}-${token.slice(16, 20)}-${token.slice(20)}`;
      repository.options.mockResolvedValue({
        branches: [{ id: branchId }],
        owners: [{ id: actor.userId }],
        documentTypes: [{ id: 'brand', code: 'BRAND_ASSET_TEMPLATE' }],
        categories: [{ id: 'category', code: 'BRAND_ASSETS' }],
      });
      repository.list.mockResolvedValue({ rows: [duplicate], total: 1 });
      if (state === 'available')
        storage.readQuarantined.mockResolvedValue(file.buffer);
      else
        storage.readQuarantined.mockRejectedValue(
          Object.assign(
            new Error(state),
            state === 'missing' ? { code: 'ENOENT' } : {},
          ),
        );
      const upload = vi.spyOn(service, 'upload').mockResolvedValue({
        data: {
          id: 'replacement',
          currentVersion: { scanStatus: 'PENDING_SCAN' },
        },
      } as never);
      const result = service.uploadMasterDataLogo(
        { resource: 'suppliers', recordId: 'supplier', title: 'لوگو' },
        file,
        { ...actor, permissions: ['master_data.update'] },
        {},
      );
      if (state === 'corrupt') {
        await expect(result).rejects.toThrow('corrupt');
        expect(upload).not.toHaveBeenCalled();
      } else {
        await expect(result).resolves.toMatchObject(
          state === 'missing'
            ? { id: 'replacement', reused: false, scanStatus: 'PENDING_SCAN' }
            : { id: duplicate.id, reused: true },
        );
        expect(upload).toHaveBeenCalledTimes(state === 'missing' ? 1 : 0);
      }
    },
  );

  it('archives a brand asset only when its primary relation matches the Master Data row', async () => {
    const logoRow = row({ domain: 'BRAND' });
    repository.findDetail.mockResolvedValue({
      ...logoRow,
      relations: [
        {
          ...logoRow.relations[0],
          sourceModule: 'master-data',
          sourceEntityType: 'airlines',
          sourceEntityId: '77777777-7777-4777-8777-777777777777',
        },
      ],
    });
    const archive = vi
      .spyOn(service, 'archive')
      .mockResolvedValue({ data: { id: logoRow.id } } as never);

    await service.archiveMasterDataLogo(
      {
        documentId: logoRow.id,
        resource: 'airlines',
        recordId: '77777777-7777-4777-8777-777777777777',
      },
      { ...actor, permissions: ['master_data.update'] },
      {},
    );

    expect(archive).toHaveBeenCalledWith(
      logoRow.id,
      expect.objectContaining({ version: logoRow.version }),
      expect.objectContaining({
        permissions: expect.arrayContaining([
          'documents.brand.read',
          'documents.delete',
        ]),
      }),
      {},
    );
  });

  it('previews a logo only when the BRAND document belongs to the exact Master Data record', async () => {
    const logoRow = row({
      domain: 'BRAND',
      confidentiality: 'INTERNAL',
      scanStatus: 'CLEAN',
      mimeType: 'image/png',
    });
    repository.findDetail.mockResolvedValue({
      ...logoRow,
      relations: [
        {
          ...logoRow.relations[0]!,
          sourceModule: 'master-data',
          sourceEntityType: 'airlines',
          sourceEntityId: 'airline-1',
        },
      ],
    });
    storage.openQuarantined.mockResolvedValue(
      Readable.from([Buffer.from('png')]),
    );
    const reader = {
      ...actor,
      permissions: ['master_data.read'] as AuthenticatedActor['permissions'],
    };
    const input = {
      documentId: logoRow.id,
      resource: 'airlines',
      recordId: 'airline-1',
    };

    const file = await service.previewMasterDataLogo(input, reader, {});
    expect(file.mimeType).toBe('image/png');
    expect(storage.openQuarantined).toHaveBeenCalledOnce();
    await expect(
      service.previewMasterDataLogo(
        { ...input, recordId: 'other-airline' },
        reader,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.openQuarantined).toHaveBeenCalledOnce();
    storage.openQuarantined.mockRejectedValueOnce(
      Object.assign(new Error('missing'), { code: 'ENOENT' }),
    );
    await expect(
      service.previewMasterDataLogo(input, reader, {}),
    ).rejects.toThrow('فایل لوگو در آرشیو موجود نیست');
    expect(storage.openQuarantined).toHaveBeenCalledTimes(2);
  });

  it('applies branch/domain scope server-side and masks sensitive list metadata', async () => {
    repository.list.mockResolvedValue({ rows: [row()], total: 1 });

    const result = await service.list({ page: 1, pageSize: 25 }, actor);

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, pageSize: 25 }),
      [branchId],
      ['GENERAL', 'SALES'],
      actor.userId,
      false,
    );
    expect(result.data[0]).toMatchObject({
      title: 'سند محرمانه ••••••',
      description: null,
      owner: {
        id: '00000000-0000-0000-0000-000000000000',
        displayName: 'محرمانه',
      },
      currentVersion: {
        originalFileName: 'سند محرمانه',
        safeDownloadName: 'سند محرمانه',
        createdBy: { id: '00000000-0000-0000-0000-000000000000' },
      },
    });
  });

  it('keeps anonymous feedback attachment identity private even from a sensitive document reader', async () => {
    const attachment = {
      ...row({ confidentiality: 'RESTRICTED', domain: 'GENERAL' }),
      sourceModule: 'WORKBENCH',
      sourceEntityType: 'WorkbenchFeedback',
      ownerUserId: '99999999-9999-4999-8999-999999999999',
      owner: {
        id: '99999999-9999-4999-8999-999999999999',
        displayName: 'فرستنده ناشناس',
      },
    } as DocumentDetailRow;
    const reader: AuthenticatedActor = {
      ...actor,
      permissions: [...actor.permissions, 'documents.sensitive.read'],
    };
    repository.list.mockResolvedValue({ rows: [attachment], total: 1 });
    repository.findDetail.mockResolvedValue(attachment);
    repository.appendAudit.mockResolvedValue({});

    const listed = await service.list({ page: 1, pageSize: 25 }, reader);
    const detailed = await service.detail(attachment.id, reader, {});

    for (const item of [listed.data[0]!, detailed.data]) {
      expect(item.owner.id).toBe('00000000-0000-0000-0000-000000000000');
      expect(item.currentVersion.originalFileName).toBe('سند محرمانه');
      expect(item.currentVersion.createdBy.id).toBe(
        '00000000-0000-0000-0000-000000000000',
      );
    }
    expect(detailed.data.versions[0]?.safeDownloadName).toBe('سند محرمانه');
    expect(detailed.data.versions[0]?.createdBy.id).toBe(
      '00000000-0000-0000-0000-000000000000',
    );
    expect(detailed.data.sourceModule).toBe('');
    expect(detailed.data.sourceEntityType).toBeNull();
    expect(detailed.data.sourceEntityIdMasked).toBeNull();
    expect(detailed.data.relations).toEqual([]);
  });

  it('masks older feedback attachments even when stored as internal', async () => {
    const attachment = {
      ...row({
        confidentiality: 'INTERNAL',
        domain: 'GENERAL',
        mimeType: 'image/jpeg',
        scanStatus: 'CLEAN',
      }),
      sourceModule: 'WORKBENCH',
      sourceEntityType: 'WorkbenchFeedback',
      ownerUserId: '99999999-9999-4999-8999-999999999999',
    } as DocumentDetailRow;
    repository.findDetail.mockResolvedValue(attachment);
    repository.appendAudit.mockResolvedValue({});

    const result = await service.detail(attachment.id, actor, {});

    expect(result.data.owner.id).toBe('00000000-0000-0000-0000-000000000000');
    expect(result.data.currentVersion.originalFileName).toBe('سند محرمانه');

    const ordinaryReader: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.file.read',
        'documents.download',
      ],
    };
    await expect(
      service.preview(attachment.id, ordinaryReader, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.download(attachment.id, ordinaryReader, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(storage.openQuarantined).not.toHaveBeenCalled();
  });

  it('does not expose an anonymous attachment filename in file responses', async () => {
    const attachment = {
      ...row({
        confidentiality: 'RESTRICTED',
        domain: 'GENERAL',
        mimeType: 'image/jpeg',
        scanStatus: 'CLEAN',
      }),
      sourceModule: 'WORKBENCH',
      sourceEntityType: 'WorkbenchFeedback',
      ownerUserId: '99999999-9999-4999-8999-999999999999',
    } as DocumentDetailRow;
    const reader: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.file.read',
        'documents.download',
        'documents.sensitive.read',
        'documents.sensitive.download',
      ],
    };
    repository.findDetail.mockResolvedValue(attachment);
    repository.appendAudit.mockResolvedValue({});
    storage.openQuarantined.mockResolvedValue(
      Readable.from(Buffer.from('test')),
    );

    const preview = await service.preview(attachment.id, reader, {
      sensitiveReason: 'بررسی پرونده',
    });
    const download = await service.download(attachment.id, reader, {
      sensitiveReason: 'بررسی پرونده',
    });

    expect(preview.fileName).toBe('protected-file.jpg');
    expect(download.fileName).toBe('protected-file.jpg');
  });

  it('does not let another user open an anonymous feedback attachment audit trail', async () => {
    const attachment = {
      ...row({ confidentiality: 'RESTRICTED', domain: 'GENERAL' }),
      sourceModule: 'WORKBENCH',
      sourceEntityType: 'WorkbenchFeedback',
      ownerUserId: '99999999-9999-4999-8999-999999999999',
    } as DocumentDetailRow;
    repository.findDetail.mockResolvedValue(attachment);
    repository.audit.mockResolvedValue([]);

    await expect(
      service.audit(attachment.id, {
        ...actor,
        permissions: [...actor.permissions, 'documents.audit.read'],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.audit).not.toHaveBeenCalled();
  });

  it('does not allow document metadata edits to remove feedback anonymity', async () => {
    const attachment = {
      ...row({ confidentiality: 'RESTRICTED', domain: 'GENERAL' }),
      sourceModule: 'WORKBENCH',
      sourceEntityType: 'WorkbenchFeedback',
    } as DocumentDetailRow;
    repository.findDetail.mockResolvedValue(attachment);

    await expect(
      service.update(
        attachment.id,
        {
          version: 1,
          title: 'new title',
          categoryId: attachment.categoryId,
          ownerUserId: attachment.ownerUserId,
          confidentiality: 'INTERNAL',
        } as never,
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.updateMetadata).not.toHaveBeenCalled();
  });

  it('normalizes a complete source reference before applying branch and domain scope', async () => {
    repository.list.mockResolvedValue({ rows: [], total: 0 });

    await service.list(
      {
        sourceModule: ' customers ',
        sourceEntityType: ' Customer ',
        sourceEntityId: ' aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa ',
      },
      actor,
    );

    expect(repository.list).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceModule: 'customers',
        sourceEntityType: 'Customer',
        sourceEntityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
      [branchId],
      ['GENERAL', 'SALES'],
      actor.userId,
      false,
    );
  });

  it('rejects partial source filters before querying the repository', async () => {
    await expect(
      service.list({ sourceModule: 'customers' }, actor),
    ).rejects.toMatchObject({
      constructor: BadRequestException,
      response: expect.objectContaining({
        code: 'DOCUMENT_SOURCE_FILTER_INCOMPLETE',
      }),
    });
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('rejects blank canonical source parts for direct service callers', async () => {
    await expect(
      service.list(
        {
          sourceModule: 'customers',
          sourceEntityType: 'Customer',
          sourceEntityId: '   ',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.list).not.toHaveBeenCalled();
  });

  it('searches only accessible cases and never returns their source identifier', async () => {
    repository.caseOptions.mockResolvedValue({
      rows: [
        {
          id: '99999999-9999-4999-8999-999999999999',
          displayLabel: 'قرارداد فروش ۴۲',
          sourceModule: 'sales',
          sourceEntityType: 'contract',
          sourceEntityId: 'SALES-REAL-42',
        },
      ],
      hasMore: false,
    });

    const result = await service.caseOptions(
      { branchId, search: '  فروش  ', limit: 20 },
      actor,
    );

    expect(repository.caseOptions).toHaveBeenCalledWith({
      branchId,
      domains: ['GENERAL', 'SALES'],
      includeSensitive: false,
      search: 'فروش',
      limit: 20,
    });
    expect(result.data[0]).toEqual({
      id: '99999999-9999-4999-8999-999999999999',
      displayLabel: 'قرارداد فروش ۴۲',
    });
    expect(result.data[0]).not.toHaveProperty('sourceEntityId');
  });

  it('does not search cases outside the actor branches', async () => {
    await expect(
      service.caseOptions(
        {
          branchId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          search: 'قرارداد',
        },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.caseOptions).not.toHaveBeenCalled();
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

  it('uses a visibility-scoped lookup for sensitive details', async () => {
    repository.findDetail.mockResolvedValue(null);

    await expect(service.detail(row().id, actor, {})).rejects.toBeInstanceOf(
      NotFoundException,
    );

    expect(repository.findDetail).toHaveBeenCalledWith(
      row().id,
      actor.branchIds,
      false,
      actor.userId,
    );
  });

  it('passes sensitive-read visibility to favorites and blocks favoriting a hidden ID', async () => {
    repository.findDetail.mockResolvedValue(null);

    await expect(
      service.setFavorite(row().id, true, actor),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(repository.findDetail).toHaveBeenCalledWith(
      row().id,
      actor.branchIds,
      false,
      actor.userId,
    );
    expect(repository.setFavorite).not.toHaveBeenCalled();

    repository.favoriteDocuments.mockResolvedValue([]);
    await service.favorites(actor);
    expect(repository.favoriteDocuments).toHaveBeenCalledWith(
      actor.userId,
      actor.branchIds,
      ['GENERAL', 'SALES'],
      false,
      actor.userId,
    );
  });

  it('scopes ID-based file, audit, and mutation routes to the actor visibility policy', async () => {
    const protectedActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.metadata.update',
        'documents.delete',
        'documents.restore',
        'documents.audit.read',
        'documents.file.read',
        'documents.download',
      ],
    };
    const documentId = row().id;
    const actions: Array<[string, () => Promise<unknown>]> = [
      [
        'metadata update',
        () => service.update(documentId, {} as never, protectedActor, {}),
      ],
      [
        'archive',
        () => service.archive(documentId, {} as never, protectedActor, {}),
      ],
      [
        'restore',
        () => service.restore(documentId, {} as never, protectedActor, {}),
      ],
      [
        'permanent delete',
        () =>
          service.permanentlyDelete(documentId, {} as never, protectedActor),
      ],
      ['audit', () => service.audit(documentId, protectedActor)],
      [
        'access grant',
        () =>
          service.createAccessGrant(
            documentId,
            {} as never,
            protectedActor,
            {},
          ),
      ],
      ['download', () => service.download(documentId, protectedActor, {})],
      ['preview', () => service.preview(documentId, protectedActor, {})],
    ];

    for (const [name, action] of actions) {
      vi.clearAllMocks();
      repository.findDetail.mockResolvedValue(null);
      await expect(action(), name).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.findDetail).toHaveBeenCalledWith(
        documentId,
        protectedActor.branchIds,
        false,
        protectedActor.userId,
      );
    }

    repository.findDetails.mockResolvedValue([]);
    await expect(
      service.bulk(
        { action: 'ARCHIVE', ids: [documentId], reason: 'review' } as never,
        protectedActor,
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.findDetails).toHaveBeenCalledWith(
      [documentId],
      protectedActor.branchIds,
      false,
      protectedActor.userId,
    );
  });

  it('exchanges a valid TOTP code for a short-lived hashed one-time grant', async () => {
    const protectedActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.file.read',
        'documents.sensitive.read',
      ],
    };
    repository.findDetail.mockResolvedValue(
      row({
        mimeType: 'image/jpeg',
        scanStatus: 'CLEAN',
        requiresStepUpVerification: true,
      }),
    );
    repository.createAccessGrant.mockResolvedValue(undefined);
    repository.appendAudit.mockResolvedValue({});
    iamStepUp.verifyStepUp.mockResolvedValue(undefined);

    const result = await service.createAccessGrant(
      row().id,
      { code: '123456', purpose: 'PREVIEW' },
      protectedActor,
      { ipAddress: '192.0.2.44', userAgent: 'vitest' },
    );

    expect(iamStepUp.verifyStepUp).toHaveBeenCalledWith(
      protectedActor,
      '123456',
      expect.any(Object),
    );
    expect(result.data.token).toMatch(/^[A-Za-z0-9_-]{40,}$/u);
    expect(result.data.token).not.toContain('123456');
    expect(repository.createAccessGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
        actorUserId: protectedActor.userId,
        actorSessionId: protectedActor.sessionId,
        purpose: 'PREVIEW',
      }),
    );
    expect(repository.createAccessGrant.mock.calls[0]?.[0].tokenHash).not.toBe(
      result.data.token,
    );
  });

  it('verifies a confidential document code and issues a session-bound view grant', async () => {
    const protectedActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.file.read',
        'documents.sensitive.read',
      ],
    };
    const salt = 'a'.repeat(48);
    const hash = scryptSync('573921', Buffer.from(salt, 'hex'), 64).toString(
      'hex',
    );
    repository.findDetail.mockResolvedValue(
      row({
        confidentialAccessCodeHash: hash,
        confidentialAccessCodeSalt: salt,
      }),
    );
    repository.confidentialAccessState.mockResolvedValue({
      confidentialAccessCodeHash: hash,
      confidentialAccessCodeSalt: salt,
      confidentialAccessLockedUntil: null,
    });
    repository.beginConfidentialAccessAttempt.mockResolvedValue(true);
    repository.createAccessGrant.mockResolvedValue(undefined);
    repository.appendAudit.mockResolvedValue({});

    const result = await service.createAccessGrant(
      row().id,
      { code: '573921', purpose: 'CONFIDENTIAL_VIEW' },
      protectedActor,
      {},
    );

    expect(repository.beginConfidentialAccessAttempt).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: row().id,
        actorUserId: protectedActor.userId,
        actorBranchId: row().branchId,
      }),
    );
    expect(repository.createAccessGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: row().id,
        actorUserId: protectedActor.userId,
        actorSessionId: protectedActor.sessionId,
        purpose: 'CONFIDENTIAL_VIEW',
      }),
    );
    expect(result.data.purpose).toBe('CONFIDENTIAL_VIEW');
    expect(result.data.token).not.toContain('573921');
  });

  it('does not disclose a protected document detail before code verification', async () => {
    repository.findDetail.mockResolvedValue(
      row({
        confidentialAccessCodeHash: 'a'.repeat(128),
        confidentialAccessCodeSalt: 'b'.repeat(48),
      }),
    );
    repository.hasConfidentialAccessGrant.mockResolvedValue(false);
    repository.appendAudit.mockResolvedValue({});

    await expect(service.detail(row().id, actor, {})).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'DOCUMENT_CONFIDENTIAL_CODE_REQUIRED',
      }),
    });
    expect(repository.appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'FAILURE',
        reason: 'CONFIDENTIAL_CODE_REQUIRED',
      }),
    );
  });

  it('also protects confidential document activity behind the same code grant', async () => {
    repository.findDetail.mockResolvedValue(
      row({
        confidentialAccessCodeHash: 'a'.repeat(128),
        confidentialAccessCodeSalt: 'b'.repeat(48),
      }),
    );
    repository.hasConfidentialAccessGrant.mockResolvedValue(false);

    await expect(service.audit(row().id, actor)).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'DOCUMENT_CONFIDENTIAL_CODE_REQUIRED',
      }),
    });
    expect(repository.audit).not.toHaveBeenCalled();
  });

  it('uses the configured document-link lifetime for access grants', async () => {
    const protectedActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.file.read',
        'documents.sensitive.read',
      ],
    };
    repository.findDetail.mockResolvedValue(
      row({
        mimeType: 'image/jpeg',
        scanStatus: 'CLEAN',
        requiresStepUpVerification: true,
      }),
    );
    repository.createAccessGrant.mockResolvedValue(undefined);
    repository.appendAudit.mockResolvedValue({});
    iamStepUp.verifyStepUp.mockResolvedValue(undefined);
    const settings = {
      json: vi.fn().mockResolvedValue({ value: { link: 12 } }),
    };
    const configured = new DocumentsService(
      repository as unknown as DocumentsRepository,
      storage as unknown as LocalDocumentStorage,
      scanProcessor as unknown as DocumentsScanProcessor,
      iamStepUp as unknown as IamStepUpPort,
      hrDirectory as unknown as HrDirectoryService,
      settings as never,
    );
    const before = Date.now();

    await configured.createAccessGrant(
      row().id,
      { code: '123456', purpose: 'PREVIEW' },
      protectedActor,
      {},
    );

    const expiresAt = repository.createAccessGrant.mock.calls[0]?.[0]
      .expiresAt as Date;
    expect(expiresAt.getTime() - before).toBeGreaterThanOrEqual(
      12 * 60_000 - 1_000,
    );
    expect(settings.json).toHaveBeenCalledWith(
      'documents',
      'access',
      { branchId },
      {},
    );
  });

  it('fails closed when a protected preview has no one-time grant', async () => {
    const protectedActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.file.read',
        'documents.sensitive.read',
      ],
    };
    repository.findDetail.mockResolvedValue(
      row({
        mimeType: 'image/jpeg',
        scanStatus: 'CLEAN',
        requiresStepUpVerification: true,
      }),
    );
    repository.appendAudit.mockResolvedValue({});

    await expect(
      service.preview(row().id, protectedActor, {
        sensitiveReason: 'بررسی پرونده',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.consumeAccessGrant).not.toHaveBeenCalled();
    expect(storage.openQuarantined).not.toHaveBeenCalled();
    expect(repository.appendAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'FAILURE',
        reason: 'PREVIEW_STEP_UP_DENIED',
      }),
    );
  });

  it('consumes a protected preview grant bound to user and session', async () => {
    const protectedActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.file.read',
        'documents.sensitive.read',
      ],
    };
    repository.findDetail.mockResolvedValue(
      row({
        mimeType: 'image/jpeg',
        scanStatus: 'CLEAN',
        requiresStepUpVerification: true,
      }),
    );
    repository.consumeAccessGrant.mockResolvedValue(true);
    repository.appendAudit.mockResolvedValue({});
    storage.openQuarantined.mockResolvedValue(
      Readable.from(Buffer.from([0xff, 0xd8, 0xff, 0xd9])),
    );

    await service.preview(row().id, protectedActor, {
      sensitiveReason: 'بررسی پرونده',
      accessGrantToken: 'one-time-grant',
    });

    expect(repository.consumeAccessGrant).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: protectedActor.userId,
        actorSessionId: protectedActor.sessionId,
        purpose: 'PREVIEW',
        tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      }),
    );
    expect(storage.openQuarantined).toHaveBeenCalledOnce();
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
    repository.findCaseReference.mockResolvedValue({
      sourceModule: 'sales',
      sourceEntityType: 'contract',
      sourceEntityId: 'SALES-42',
      displayLabel: 'قرارداد فروش ۴۲',
    });
    const dto = {
      title: 'قرارداد واقعی',
      documentTypeId: '55555555-5555-4555-8555-555555555555',
      categoryId: '66666666-6666-4666-8666-666666666666',
      branchId,
      ownerUserId: actor.userId,
      sourceRelationId: '99999999-9999-4999-8999-999999999999',
      confidentiality: 'CONFIDENTIAL',
      confidentialAccessCode: '573921',
    } satisfies DocumentUploadDto;
    const buffer = Buffer.from('%PDF-1.7\nreal synthetic test bytes');
    const settings = {
      json: vi.fn().mockImplementation((namespace: string, key: string) =>
        Promise.resolve({
          value:
            namespace === 'documents' && key === 'upload'
              ? { size: 8, types: 'PDF' }
              : { classification: 'محرمانه' },
        }),
      ),
    };
    const configured = new DocumentsService(
      repository as unknown as DocumentsRepository,
      storage as unknown as LocalDocumentStorage,
      scanProcessor as unknown as DocumentsScanProcessor,
      iamStepUp as unknown as IamStepUpPort,
      hrDirectory as unknown as HrDirectoryService,
      settings as never,
    );

    const result = await configured.upload(
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
        confidentiality: 'CONFIDENTIAL',
        ipSummary: '192.0.2.x',
        sourceModule: 'sales',
        sourceEntityType: 'contract',
        sourceEntityId: 'SALES-42',
        sourceDisplayLabel: 'قرارداد فروش ۴۲',
        confidentialAccessCodeHash: expect.stringMatching(/^[a-f0-9]{128}$/u),
        confidentialAccessCodeSalt: expect.stringMatching(/^[a-f0-9]{48}$/u),
      }),
    );
    expect(repository.createUploaded.mock.calls[0]?.[0]).not.toHaveProperty(
      'confidentialAccessCode',
    );
    expect(result.data.currentVersion.scanStatus).toBe(
      'AWAITING_ANTIVIRUS_ADAPTER',
    );
  });

  it('stores an unlinked workbench document for its signed-in owner only', async () => {
    const dto: DocumentUploadDto = {
      title: 'فایل شخصی',
      documentTypeId: row().documentTypeId,
      categoryId: row().categoryId!,
      branchId,
      ownerUserId: actor.userId,
      sourceModule: 'WORKBENCH',
      sourceEntityType: 'WorkbenchPersonalDocument',
      sourceEntityId: actor.userId,
      sourceDisplayLabel: 'برچسب دلخواه کاربر',
    };
    const buffer = Buffer.from('%PDF-1.7\nsynthetic personal document');
    const file = {
      buffer,
      mimetype: 'application/pdf',
      originalname: 'personal.pdf',
      size: buffer.length,
    };
    repository.uploadReferences.mockResolvedValue({
      documentType: {
        id: dto.documentTypeId,
        domain: 'SALES',
        defaultConfidentiality: 'INTERNAL',
        allowedMimeTypes: ['application/pdf'],
        maxFileSizeBytes: 25 * 1024 * 1024,
        requiresExpiry: false,
      },
      category: { id: dto.categoryId },
      owner: { id: actor.userId },
      branch: { id: branchId },
    });
    repository.createUploaded.mockResolvedValue(
      row({ confidentiality: 'INTERNAL' }),
    );

    await service.upload(dto, file, actor, {});
    expect(repository.findCaseReference).not.toHaveBeenCalled();
    expect(repository.createUploaded).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: actor.userId,
        sourceModule: 'WORKBENCH',
        sourceEntityType: 'WorkbenchPersonalDocument',
        sourceEntityId: actor.userId,
        sourceDisplayLabel: 'فایل شخصی',
      }),
    );

    repository.createUploaded.mockClear();
    await expect(
      service.upload(
        { ...dto, ownerUserId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        file,
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.upload(
        { ...dto, sourceEntityId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        file,
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createUploaded).not.toHaveBeenCalled();
  });

  it('accepts an archive upload without a related case and persists no primary relation', async () => {
    const dto: DocumentUploadDto = {
      title: 'Standalone archive file',
      documentTypeId: row().documentTypeId,
      categoryId: row().categoryId!,
      branchId,
      ownerUserId: actor.userId,
      confidentiality: 'INTERNAL',
    };
    const buffer = Buffer.from('%PDF-1.7\nsynthetic standalone document');
    repository.uploadReferences.mockResolvedValue({
      documentType: {
        id: dto.documentTypeId,
        domain: 'SALES',
        defaultConfidentiality: 'INTERNAL',
        allowedMimeTypes: ['application/pdf'],
        maxFileSizeBytes: 25 * 1024 * 1024,
        requiresExpiry: false,
      },
      category: { id: dto.categoryId },
      owner: { id: actor.userId },
      branch: { id: branchId },
    });
    repository.createUploaded.mockResolvedValue(
      row({ confidentiality: 'INTERNAL' }),
    );
    await service.upload(
      dto,
      {
        buffer,
        mimetype: 'application/pdf',
        originalname: 'standalone.pdf',
        size: buffer.length,
      },
      actor,
      {},
    );
    expect(repository.findCaseReference).not.toHaveBeenCalled();
    expect(repository.createUploaded).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceModule: 'DOCUMENTS',
        sourceEntityType: null,
        sourceEntityId: null,
        sourceDisplayLabel: null,
      }),
    );
  });

  it('requires an access code for newly uploaded confidential documents', async () => {
    const dto: DocumentUploadDto = {
      title: 'Confidential archive file',
      documentTypeId: row().documentTypeId,
      categoryId: row().categoryId!,
      branchId,
      ownerUserId: actor.userId,
      confidentiality: 'CONFIDENTIAL',
    };
    repository.uploadReferences.mockResolvedValue({
      documentType: {
        id: dto.documentTypeId,
        domain: 'SALES',
        defaultConfidentiality: 'INTERNAL',
        allowedMimeTypes: ['application/pdf'],
        maxFileSizeBytes: 25 * 1024 * 1024,
        requiresExpiry: false,
      },
      category: { id: dto.categoryId },
      owner: { id: actor.userId },
      branch: { id: branchId },
    });

    await expect(
      service.upload(
        dto,
        {
          buffer: Buffer.from('%PDF-1.7\nsynthetic'),
          mimetype: 'application/pdf',
          originalname: 'confidential.pdf',
          size: 18,
        },
        actor,
        {},
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'DOCUMENT_CONFIDENTIAL_CODE_REQUIRED',
      }),
    });
    expect(storage.putQuarantined).not.toHaveBeenCalled();
  });

  it('resolves an HR employee through its public service and rejects stale or cross-branch source references before storage', async () => {
    const hrActor: AuthenticatedActor = {
      ...actor,
      permissions: [...actor.permissions, 'documents.hr.read'],
    };
    const employeeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    repository.uploadReferences.mockResolvedValue({
      documentType: {
        id: row().documentTypeId,
        domain: 'HUMAN_RESOURCES',
        defaultConfidentiality: 'INTERNAL',
        allowedMimeTypes: ['application/pdf'],
        maxFileSizeBytes: 25000000,
        requiresExpiry: false,
      },
      category: { id: row().categoryId },
      owner: { id: actor.userId },
      branch: { id: branchId },
    });
    repository.createUploaded.mockResolvedValue(
      row({ domain: 'HUMAN_RESOURCES', confidentiality: 'INTERNAL' }),
    );
    hrDirectory.employee.mockResolvedValue({
      id: employeeId,
      name: 'Canonical HR employee',
      personnelCode: 'HR-42',
    });
    const dto: DocumentUploadDto = {
      title: 'Employee archive',
      documentTypeId: row().documentTypeId,
      categoryId: row().categoryId!,
      branchId,
      ownerUserId: actor.userId,
      sourceModule: 'HUMAN_RESOURCES',
      sourceEntityType: 'Employee',
      sourceEntityId: employeeId,
      sourceDisplayLabel: 'Forged display label',
    };
    const buffer = Buffer.from('%PDF-1.7\nsynthetic employee document');
    const file = {
      buffer,
      mimetype: 'application/pdf',
      originalname: 'employee.pdf',
      size: buffer.length,
    };
    await service.upload(dto, file, hrActor, {});
    expect(hrDirectory.employee).toHaveBeenCalledWith(
      employeeId,
      branchId,
      hrActor,
    );
    expect(repository.createUploaded).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceEntityId: employeeId,
        sourceDisplayLabel: 'Canonical HR employee · HR-42',
      }),
    );
    storage.putQuarantined.mockClear();
    repository.createUploaded.mockClear();
    hrDirectory.employee.mockRejectedValueOnce(
      new ForbiddenException('Employee outside branch'),
    );
    await expect(service.upload(dto, file, hrActor, {})).rejects.toThrow(
      'Employee outside branch',
    );
    expect(storage.putQuarantined).not.toHaveBeenCalled();
    expect(repository.createUploaded).not.toHaveBeenCalled();
    await expect(service.upload(dto, file, actor, {})).rejects.toBeInstanceOf(
      ForbiddenException,
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

  it('updates editable metadata and the incomplete flag with optimistic locking', async () => {
    const editableActor: AuthenticatedActor = {
      ...actor,
      permissions: [...actor.permissions, 'documents.metadata.update'],
    };
    repository.findDetail.mockResolvedValue(row());
    repository.editReferences.mockResolvedValue({
      category: { id: row().categoryId },
      owner: { id: row().ownerUserId },
    });
    repository.updateMetadata.mockResolvedValue(
      row({ isIncomplete: true, version: 2 }),
    );

    const result = await service.update(
      row().id,
      {
        title: ' قرارداد اصلاح‌شده ',
        description: ' توضیح تازه ',
        categoryId: row().categoryId!,
        ownerUserId: row().ownerUserId,
        confidentiality: 'INTERNAL',
        validUntil: '2026-12-01',
        isIncomplete: true,
        version: 1,
      },
      editableActor,
      { ipAddress: '192.0.2.44', userAgent: 'vitest' },
    );

    expect(repository.updateMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: row().id,
        expectedVersion: 1,
        title: 'قرارداد اصلاح‌شده',
        description: 'توضیح تازه',
        isIncomplete: true,
      }),
    );
    expect(result.data.isIncomplete).toBe(true);
    expect(result.data.version).toBe(2);
  });

  it('requires the same-session code grant before every coded-document mutation', async () => {
    const coded = row({ confidentialAccessCodeHash: 'a'.repeat(128) });
    const mutatingActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.metadata.update',
        'documents.delete',
        'documents.restore',
        'documents.sensitive.read',
      ],
    };
    repository.findDetail.mockResolvedValue(coded);
    repository.findDetails.mockResolvedValue([coded]);
    repository.hasConfidentialAccessGrant.mockResolvedValue(false);
    const update = {
      title: coded.title,
      categoryId: coded.categoryId!,
      ownerUserId: coded.ownerUserId,
      confidentiality: 'CONFIDENTIAL' as const,
      isIncomplete: false,
      version: coded.version,
    };
    const operations = [
      () => service.update(coded.id, update, mutatingActor, {}),
      () =>
        service.archive(
          coded.id,
          { reason: 'archive reason', version: 1 },
          mutatingActor,
          {},
        ),
      () =>
        service.restore(
          coded.id,
          { reason: 'restore reason', version: 1 },
          mutatingActor,
          {},
        ),
      () =>
        service.bulk(
          {
            ids: [coded.id],
            action: 'MARK_INCOMPLETE',
            reason: 'incomplete reason',
          },
          mutatingActor,
          {},
        ),
      () =>
        service.permanentlyDelete(
          coded.id,
          { reason: 'permanent delete reason', version: 1 },
          mutatingActor,
          {},
        ),
    ];
    for (const operation of operations) {
      await expect(operation()).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'DOCUMENT_CONFIDENTIAL_CODE_REQUIRED',
        }),
      });
    }
    expect(repository.updateMetadata).not.toHaveBeenCalled();
    expect(repository.changeArchiveStatus).not.toHaveBeenCalled();
    expect(repository.bulkAction).not.toHaveBeenCalled();
    expect(repository.permanentlyDelete).not.toHaveBeenCalled();
    expect(storage.removeQuarantined).not.toHaveBeenCalled();
  });

  it('authorizes organization proof from raw owner state and same-session confidential grant', async () => {
    const proof = row({
      domain: 'ORGANIZATION',
      scanStatus: 'CLEAN',
      confidentialAccessCodeHash: 'a'.repeat(128),
    });
    proof.sourceModule = 'master-data';
    proof.sourceEntityType = 'organizations';
    proof.sourceEntityId = 'organization';
    proof.relations = [
      {
        ...proof.relations[0]!,
        relationType: 'PRIMARY_CASE',
        sourceModule: 'master-data',
        sourceEntityType: 'organizations',
        sourceEntityId: 'organization',
      },
    ];
    repository.findDetail.mockResolvedValue(proof);
    repository.hasConfidentialAccessGrant.mockResolvedValue(true);
    const proofActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        'documents.list',
        'documents.organization.read',
        'documents.metadata.read',
        'documents.sensitive.read',
      ],
    };
    await expect(
      service.assertOrganizationProofReference(
        {
          documentId: proof.id,
          organizationId: 'organization',
          branchId,
          expectedVersionId: proof.currentVersion!.id,
          confidentialGrantToken: 'fresh-token',
        },
        proofActor,
      ),
    ).resolves.toEqual({
      documentId: proof.id,
      versionId: proof.currentVersion!.id,
    });
    expect(repository.hasConfidentialAccessGrant).toHaveBeenCalledWith({
      tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/u),
      documentId: proof.id,
      actorUserId: proofActor.userId,
      actorSessionId: proofActor.sessionId,
    });
  });

  it('rejects raw expired coded proof even though masked projections hide expiry', async () => {
    const proof = row({
      domain: 'ORGANIZATION',
      scanStatus: 'CLEAN',
      confidentialAccessCodeHash: 'a'.repeat(128),
    });
    proof.validUntil = new Date('2000-01-01T00:00:00.000Z');
    proof.relations = [
      {
        ...proof.relations[0]!,
        relationType: 'PRIMARY_CASE',
        sourceModule: 'master-data',
        sourceEntityType: 'organizations',
        sourceEntityId: 'organization',
      },
    ];
    repository.findDetail.mockResolvedValue(proof);
    repository.hasConfidentialAccessGrant.mockResolvedValue(true);
    await expect(
      service.assertOrganizationProofReference(
        {
          documentId: proof.id,
          organizationId: 'organization',
          branchId,
          confidentialGrantToken: 'fresh-token',
        },
        {
          ...actor,
          permissions: [
            'documents.list',
            'documents.organization.read',
            'documents.metadata.read',
            'documents.sensitive.read',
          ],
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'B2B_DOCUMENT_NOT_READY' }),
    });
  });

  it('does not let another actor or session reuse a maker confidential grant', async () => {
    const proof = row({
      domain: 'ORGANIZATION',
      scanStatus: 'CLEAN',
      confidentialAccessCodeHash: 'a'.repeat(128),
    });
    proof.relations = [
      {
        ...proof.relations[0]!,
        relationType: 'PRIMARY_CASE',
        sourceModule: 'master-data',
        sourceEntityType: 'organizations',
        sourceEntityId: 'organization',
      },
    ];
    repository.findDetail.mockResolvedValue(proof);
    repository.hasConfidentialAccessGrant.mockImplementation(
      async (input: { actorUserId: string; actorSessionId: string }) =>
        input.actorUserId === actor.userId &&
        input.actorSessionId === actor.sessionId,
    );
    const permissions: AuthenticatedActor['permissions'] = [
      'documents.list',
      'documents.organization.read',
      'documents.metadata.read',
      'documents.sensitive.read',
    ];
    await expect(
      service.assertOrganizationProofReference(
        {
          documentId: proof.id,
          organizationId: 'organization',
          branchId,
          confidentialGrantToken: 'maker-token',
        },
        { ...actor, permissions },
      ),
    ).resolves.toBeDefined();
    await expect(
      service.assertOrganizationProofReference(
        {
          documentId: proof.id,
          organizationId: 'organization',
          branchId,
          confidentialGrantToken: 'maker-token',
        },
        {
          ...actor,
          userId: '99999999-9999-4999-8999-999999999999',
          sessionId: '88888888-8888-4888-8888-888888888888',
          permissions,
        },
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'DOCUMENT_CONFIDENTIAL_CODE_REQUIRED',
      }),
    });
  });

  it('rejects downgrading a coded document even with a valid same-session grant', async () => {
    const coded = row({ confidentialAccessCodeHash: 'a'.repeat(128) });
    const mutatingActor: AuthenticatedActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.metadata.update',
        'documents.sensitive.read',
      ],
    };
    repository.findDetail.mockResolvedValue(coded);
    repository.hasConfidentialAccessGrant.mockResolvedValue(true);
    await expect(
      service.update(
        coded.id,
        {
          title: coded.title,
          categoryId: coded.categoryId!,
          ownerUserId: coded.ownerUserId,
          confidentiality: 'INTERNAL',
          isIncomplete: false,
          version: coded.version,
        },
        mutatingActor,
        { confidentialAccessGrantToken: 'valid-grant' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.hasConfidentialAccessGrant).toHaveBeenCalledWith(
      expect.objectContaining({ actorSessionId: mutatingActor.sessionId }),
    );
    expect(repository.updateMetadata).not.toHaveBeenCalled();
  });

  it('restores only an archived document without legal hold', async () => {
    const restoreActor: AuthenticatedActor = {
      ...actor,
      permissions: [...actor.permissions, 'documents.restore'],
    };
    const archived = row({ archiveStatus: 'ARCHIVED' });
    repository.findDetail.mockResolvedValue(archived);
    repository.changeArchiveStatus.mockResolvedValue(row({ version: 2 }));

    await service.restore(
      archived.id,
      { reason: 'بازگشت به چرخه فعال', version: 1 },
      restoreActor,
      { ipAddress: '192.0.2.44' },
    );

    expect(repository.changeArchiveStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedStatus: 'ARCHIVED',
        nextStatus: 'ACTIVE',
        action: 'documents.restore',
      }),
    );
  });

  it('runs a real bulk incomplete action for every selected document', async () => {
    const editableActor: AuthenticatedActor = {
      ...actor,
      permissions: [...actor.permissions, 'documents.metadata.update'],
    };
    repository.findDetails.mockResolvedValue([row()]);
    repository.bulkAction.mockResolvedValue(1);

    const result = await service.bulk(
      {
        ids: [row().id],
        action: 'MARK_INCOMPLETE',
        reason: 'مدارک پرونده کامل نیست',
      },
      editableActor,
      { ipAddress: '192.0.2.44' },
    );

    expect(repository.bulkAction).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'MARK_INCOMPLETE' }),
    );
    expect(result.data.updatedCount).toBe(1);
  });

  it('permanently removes database records and every stored version', async () => {
    const deleteActor: AuthenticatedActor = {
      ...actor,
      permissions: [...actor.permissions, 'documents.delete'],
    };
    const document = row();
    repository.findDetail.mockResolvedValue(document);
    repository.permanentlyDelete.mockResolvedValue(true);
    storage.removeQuarantined.mockResolvedValue(undefined);

    await service.permanentlyDelete(
      document.id,
      { reason: 'حذف قطعی رکورد اشتباه', version: 1 },
      deleteActor,
    );

    expect(storage.removeQuarantined).toHaveBeenCalledWith(
      document.versions[0]?.storageObjectKey,
    );
    expect(repository.permanentlyDelete).toHaveBeenCalledWith({
      documentId: document.id,
      expectedVersion: 1,
      actorUserId: deleteActor.userId,
      ownerUserId: document.ownerUserId,
      documentTitle: document.title,
    });
  });
});
