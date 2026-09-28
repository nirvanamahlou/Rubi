import { describe, expect, it, vi } from 'vitest';
import { DocumentsService } from '../documents/documents.service';
import type { DocumentsRepository } from '../documents/documents.repository';
import type { LocalDocumentStorage } from '../documents/documents.storage';
import type { DocumentsScanProcessor } from '../documents/documents.scan-processor';
import type { IamStepUpPort } from '../iam/iam-step-up.port';
import type { HrDirectoryService } from '../hr/hr-directory.service';
import type { AuthenticatedActor } from '@nora/contracts';

const branchId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';
const documentId = '33333333-3333-4333-8333-333333333333';
const actor: AuthenticatedActor = {
  userId,
  sessionId: 'session',
  branchIds: [branchId],
  permissions: ['marketing.read', 'marketing.content.manage'],
};
const file = {
  buffer: Buffer.from('%PDF-1.4 sample'),
  mimetype: 'application/pdf',
  originalname: 'brochure.pdf',
  size: 15,
};
const row = (
  scanStatus = 'CLEAN',
  overrides: Record<string, unknown> = {},
) => ({
  id: documentId,
  title: 'Brochure',
  description: null,
  branchId,
  sourceModule: 'MARKETING',
  sourceEntityType: 'MarketingContentAsset',
  sourceEntityId: '44444444-4444-4444-8444-444444444444',
  documentType: { code: 'BRAND_ASSET_TEMPLATE', domain: 'BRAND' },
  category: { code: 'BRAND_ASSETS' },
  confidentiality: 'INTERNAL',
  archiveStatus: 'ACTIVE',
  deletedAt: null,
  requiresStepUpVerification: false,
  archiveCode: 'DOC-1',
  createdAt: new Date('2026-09-28T00:00:00Z'),
  currentVersion: {
    id: '55555555-5555-4555-8555-555555555555',
    versionNote: 'marketing-kind:brochure',
    originalFileName: 'brochure.pdf',
    detectedMimeType: 'application/pdf',
    sizeBytes: 15n,
    scanStatus,
    safeDownloadName: 'brochure.pdf',
    storageObjectKey: 'documents/abc',
  },
  ...overrides,
});

function setup() {
  const repository = {
    options: vi.fn().mockResolvedValue({
      branches: [{ id: branchId, name: 'Branch', code: 'BR' }],
      owners: [{ id: userId }],
      documentTypes: [
        {
          id: '66666666-6666-4666-8666-666666666666',
          code: 'BRAND_ASSET_TEMPLATE',
          domain: 'BRAND',
        },
      ],
      categories: [
        { id: '77777777-7777-4777-8777-777777777777', code: 'BRAND_ASSETS' },
      ],
    }),
    findDetail: vi.fn().mockResolvedValue(row()),
    uploadReferences: vi.fn().mockResolvedValue({
      documentType: { domain: 'BRAND' },
      category: {},
      owner: {},
      branch: {},
    }),
    listMarketingContentAssets: vi
      .fn()
      .mockResolvedValue({ rows: [row()], total: 1 }),
    appendAudit: vi.fn().mockResolvedValue(undefined),
  };
  const storage = { openQuarantined: vi.fn().mockResolvedValue('stream') };
  const service = new DocumentsService(
    repository as unknown as DocumentsRepository,
    storage as unknown as LocalDocumentStorage,
    {} as DocumentsScanProcessor,
    {} as IamStepUpPort,
    {} as HrDirectoryService,
  );
  return { service, repository, storage };
}

describe('Marketing content Documents boundary', () => {
  it('pins the BRAND relation, owner and kind for a marketing-only actor', async () => {
    const { service } = setup();
    const upload = vi
      .spyOn(
        service as unknown as {
          uploadCore: (...args: never[]) => Promise<unknown>;
        },
        'uploadCore',
      )
      .mockResolvedValue({
        data: {
          id: documentId,
          currentVersion: { scanStatus: 'CLEAN' },
        },
      });
    const result = await service.uploadMarketingContentAsset(
      { branchId, title: 'Brochure', kind: 'brochure' },
      file,
      actor,
      {},
    );
    expect(result.documentId).toBe(documentId);
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        documentTypeId: '66666666-6666-4666-8666-666666666666',
        categoryId: '77777777-7777-4777-8777-777777777777',
        ownerUserId: userId,
        branchId,
        confidentiality: 'INTERNAL',
        sourceModule: 'MARKETING',
        sourceEntityType: 'MarketingContentAsset',
        versionNote: 'marketing-kind:brochure',
      }),
      file,
      expect.objectContaining({
        permissions: expect.arrayContaining(['documents.brand.read']),
      }),
      {},
      true,
    );
    expect(
      (upload.mock.calls[0]?.[0] as { sourceEntityId?: string } | undefined)
        ?.sourceEntityId,
    ).toMatch(/^[0-9a-f-]{36}$/u);
    expect(actor.permissions).not.toContain('documents.upload');
  });

  it('rejects forged Marketing source fields through generic Documents upload', async () => {
    const { service } = setup();
    const genericActor = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'documents.brand.read',
        'documents.upload',
      ] as AuthenticatedActor['permissions'],
    };
    await expect(
      service.upload(
        {
          title: 'Forged',
          documentTypeId: '66666666-6666-4666-8666-666666666666',
          categoryId: '77777777-7777-4777-8777-777777777777',
          branchId,
          ownerUserId: userId,
          sourceModule: 'MARKETING',
          sourceEntityType: 'MarketingContentAsset',
          sourceEntityId: '44444444-4444-4444-8444-444444444444',
          sourceDisplayLabel: 'Forged',
          versionNote: 'marketing-kind:brochure',
        },
        file,
        genericActor,
        {},
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('returns the persisted scan state and blocks download until CLEAN', async () => {
    const { service, repository, storage } = setup();
    repository.findDetail.mockResolvedValue(row('AWAITING_ANTIVIRUS_ADAPTER'));
    expect(
      (await service.readMarketingContentAsset(documentId, actor)).scanStatus,
    ).toBe('AWAITING_ANTIVIRUS_ADAPTER');
    await expect(
      service.downloadMarketingContentAsset(documentId, actor, {}),
    ).rejects.toMatchObject({ status: 409 });
    for (const scanStatus of ['INFECTED', 'SCAN_FAILED', 'QUARANTINED']) {
      repository.findDetail.mockResolvedValue(row(scanStatus));
      expect(
        (await service.readMarketingContentAsset(documentId, actor)).scanStatus,
      ).toBe(scanStatus);
      await expect(
        service.downloadMarketingContentAsset(documentId, actor, {}),
      ).rejects.toMatchObject({ status: 409 });
    }
    expect(storage.openQuarantined).not.toHaveBeenCalled();
    repository.findDetail.mockResolvedValue(row());
    await service.downloadMarketingContentAsset(documentId, actor, {});
    expect(storage.openQuarantined).toHaveBeenCalledWith('documents/abc', 15);
  });

  it('lists only repository-scoped persisted assets and denies other branches/sources', async () => {
    const { service, repository } = setup();
    expect((await service.listMarketingContentAssets(actor)).data).toHaveLength(
      1,
    );
    expect(repository.listMarketingContentAssets).toHaveBeenCalledWith(
      [branchId],
      1,
      25,
    );
    await service.listMarketingContentAssets(actor, 2);
    expect(repository.listMarketingContentAssets).toHaveBeenCalledWith(
      [branchId],
      2,
      25,
    );
    repository.listMarketingContentAssets.mockResolvedValueOnce({
      rows: [row(), row('CLEAN', { sourceEntityId: 'not-a-uuid' })],
      total: 2,
    });
    expect((await service.listMarketingContentAssets(actor)).data).toHaveLength(
      1,
    );
    repository.findDetail.mockResolvedValueOnce(null);
    await expect(
      service.readMarketingContentAsset(documentId, actor),
    ).rejects.toMatchObject({ status: 403 });
    repository.findDetail.mockResolvedValueOnce(
      row('CLEAN', { sourceModule: 'WORKBENCH' }),
    );
    await expect(
      service.downloadMarketingContentAsset(documentId, actor, {}),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('rejects permission, branch, invalid kind, file and missing BRAND configuration', async () => {
    const { service, repository } = setup();
    const input = { branchId, title: 'Brochure', kind: 'brochure' as const };
    await expect(
      service.uploadMarketingContentAsset(
        input,
        file,
        { ...actor, permissions: ['marketing.read'] },
        {},
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.uploadMarketingContentAsset(
        { ...input, branchId: documentId },
        file,
        actor,
        {},
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      service.uploadMarketingContentAsset(
        { ...input, kind: 'unknown' as never },
        file,
        actor,
        {},
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.uploadMarketingContentAsset(
        input,
        { ...file, mimetype: 'image/png' },
        actor,
        {},
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.uploadMarketingContentAsset(
        input,
        {
          ...file,
          buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          size: 8,
        },
        actor,
        {},
      ),
    ).rejects.toMatchObject({ status: 400 });
    repository.options.mockResolvedValueOnce({
      branches: [],
      owners: [],
      documentTypes: [],
      categories: [],
    });
    await expect(
      service.uploadMarketingContentAsset(input, file, actor, {}),
    ).rejects.toMatchObject({ status: 403 });
  });
});
