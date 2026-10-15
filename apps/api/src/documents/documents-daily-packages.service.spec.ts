import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  dailyPackageDateRange,
  DocumentsDailyPackagesService,
} from './documents-daily-packages.service';
import { DocumentsDailyPackagesRepository } from './documents-daily-packages.repository';
import { DocumentsService } from './documents.service';

const actor: AuthenticatedActor = {
  userId: 'author',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: [],
};
const file = {
  buffer: Buffer.from('%PDF-1.4 test'),
  mimetype: 'application/pdf',
  originalname: 'package.pdf',
  size: 13,
};
const options = {
  documentTypes: [{ id: 'type', code: 'BRAND_ASSET_TEMPLATE' }],
  categories: [{ id: 'category', code: 'BRAND_ASSETS' }],
  branches: [{ id: 'branch', name: 'شعبه' }],
};
function setup() {
  const repository = {
    options: vi.fn().mockResolvedValue(options),
    findDetail: vi.fn(),
  };
  const documents = {
    upload: vi.fn().mockResolvedValue({ data: { id: 'doc' } }),
    download: vi.fn().mockResolvedValue({ stream: 'file' }),
  };
  const daily = { list: vi.fn().mockResolvedValue({ rows: [], total: 0 }) };
  const service = new DocumentsDailyPackagesService(
    repository as never,
    documents as never,
    daily as never,
  );
  return { repository, documents, daily, service };
}
const row = {
  sourceModule: 'WORKBENCH',
  sourceEntityType: 'WorkbenchDailyPackage',
  sourceEntityId: 'branch',
  branchId: 'branch',
  confidentiality: 'INTERNAL',
  documentType: { code: 'BRAND_ASSET_TEMPLATE' },
  currentVersion: { detectedMimeType: 'application/pdf' },
};

describe('daily packages authorization and persistence', () => {
  it('uses the full Tehran day with an exclusive next-day boundary', () => {
    const result = dailyPackageDateRange('2026-10-15');
    expect(result.from.toISOString()).toBe('2026-10-14T20:30:00.000Z');
    expect(result.to.toISOString()).toBe('2026-10-15T20:30:00.000Z');
    expect(() => dailyPackageDateRange('2026-02-31')).toThrow(
      BadRequestException,
    );
  });
  it('rejects list and publish outside the actor branches before any storage call', async () => {
    const { service, daily, documents } = setup();
    await expect(service.list({ branchId: 'other' }, actor)).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.publish({ branchId: 'other', title: 'x' }, file, actor, {}),
    ).rejects.toThrow(ForbiddenException);
    expect(daily.list).not.toHaveBeenCalled();
    expect(documents.upload).not.toHaveBeenCalled();
  });
  it('fixes the owner, branch, source, type and confidentiality on upload', async () => {
    const { service, documents } = setup();
    await service.publish(
      { branchId: 'branch', title: ' پکیج امروز ' },
      file,
      actor,
      {},
    );
    expect(documents.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'پکیج امروز',
        ownerUserId: actor.userId,
        branchId: 'branch',
        documentTypeId: 'type',
        categoryId: 'category',
        confidentiality: 'INTERNAL',
        sourceModule: 'WORKBENCH',
        sourceEntityType: 'WorkbenchDailyPackage',
        sourceEntityId: 'branch',
      }),
      file,
      expect.objectContaining({ userId: actor.userId, branchIds: ['branch'] }),
      {},
    );
    expect(actor.permissions).toEqual([]);
  });
  it('rejects missing, non-PDF and oversized files', async () => {
    const { service, documents } = setup();
    for (const invalid of [
      undefined,
      { ...file, mimetype: 'text/html' },
      { ...file, size: 26 * 1024 * 1024 },
    ])
      await expect(
        service.publish({ branchId: 'branch', title: 'x' }, invalid, actor, {}),
      ).rejects.toThrow(BadRequestException);
    expect(documents.upload).not.toHaveBeenCalled();
  });
  it('shows another author package only through the same permitted branch source', async () => {
    const { service, daily } = setup();
    daily.list.mockResolvedValue({
      rows: [
        {
          id: 'doc',
          title: 'پکیج',
          branchId: 'branch',
          owner: { displayName: 'Other author' },
          createdAt: new Date('2026-10-15T08:00:00Z'),
          currentVersion: { scanStatus: 'CLEAN' },
        },
      ],
      total: 1,
    } as never);
    const result = await service.list(
      { branchId: 'branch', date: '2026-10-15' },
      actor,
    );
    expect(result.data[0]?.authorName).toBe('Other author');
    expect(daily.list).toHaveBeenCalledWith(
      expect.objectContaining({ branchId: 'branch', pageSize: 12 }),
    );
  });
  it.each([
    null,
    { ...row, sourceEntityType: 'IamProfile' },
    { ...row, branchId: 'other' },
    { ...row, sourceEntityId: 'other' },
    { ...row, confidentiality: 'RESTRICTED' },
    { ...row, confidentialAccessCodeHash: 'secret' },
    { ...row, requiresStepUpVerification: true },
    { ...row, currentVersion: { detectedMimeType: 'text/html' } },
  ])(
    'refuses an unrelated or protected document before delivery',
    async (candidate) => {
      const { service, repository, documents } = setup();
      repository.findDetail.mockResolvedValue(candidate);
      await expect(service.file('doc', actor, {})).rejects.toThrow(
        NotFoundException,
      );
      expect(documents.download).not.toHaveBeenCalled();
    },
  );
  it('retains the standard antivirus denial and audit path', async () => {
    const { service, repository, documents } = setup();
    repository.findDetail.mockResolvedValue(row);
    documents.download.mockRejectedValue(new ConflictException('scan pending'));
    await expect(service.file('doc', actor, {})).rejects.toThrow(
      'scan pending',
    );
    expect(repository.findDetail).toHaveBeenCalledWith(
      'doc',
      ['branch'],
      false,
      actor.userId,
    );
  });
  it('rechecks the source on the final delivery read if metadata changes concurrently', async () => {
    const repository = {
      findDetail: vi
        .fn()
        .mockResolvedValue({ ...row, sourceEntityType: 'IamProfile' }),
    };
    const documents = new DocumentsService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    await expect(
      documents.download(
        'doc',
        actor,
        {},
        {
          sourceModule: 'WORKBENCH',
          sourceEntityType: 'WorkbenchDailyPackage',
          sourceEntityId: 'branch',
        },
      ),
    ).rejects.toThrow(NotFoundException);
  });
  it('queries exact source, confidentiality and UTC day before pagination', async () => {
    const findMany = vi.fn().mockResolvedValue([]),
      count = vi.fn().mockResolvedValue(0);
    const client = {
      document: { findMany, count },
      $transaction: (jobs: Promise<unknown>[]) => Promise.all(jobs),
    };
    const repository = new DocumentsDailyPackagesRepository({
      client,
    } as never);
    const range = dailyPackageDateRange('2026-10-15');
    await repository.list({
      branchId: 'branch',
      ...range,
      page: 2,
      pageSize: 12,
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 12,
        take: 12,
        where: expect.objectContaining({
          branchId: 'branch',
          sourceModule: 'WORKBENCH',
          sourceEntityType: 'WorkbenchDailyPackage',
          sourceEntityId: 'branch',
          confidentiality: 'INTERNAL',
          confidentialAccessCodeHash: null,
          requiresStepUpVerification: false,
          createdAt: { gte: range.from, lt: range.to },
        }),
      }),
    );
  });
});
