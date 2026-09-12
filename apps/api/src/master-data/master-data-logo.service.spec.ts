import type { AuthenticatedActor, MasterDataRecord } from '@rubi/contracts';
import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import type { DocumentsService } from '../documents/documents.service';
import { MasterDataLogoService } from './master-data-logo.service';
import type { MasterDataService } from './master-data.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  branchIds: ['33333333-3333-4333-8333-333333333333'],
  permissions: ['master_data.update'],
};

function record(
  attributes: MasterDataRecord['attributes'] = {},
  version = 3,
): MasterDataRecord {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    resource: 'airlines',
    code: 'IR',
    name: 'هواپیمایی ایران',
    status: 'active',
    attributes,
    version,
    createdAt: '2026-09-12T08:00:00.000Z',
    updatedAt: '2026-09-12T08:00:00.000Z',
  };
}

function setup(current = record()) {
  const masterData = {
    resource: vi.fn((value: string) => value),
    detail: vi.fn().mockResolvedValue({ data: current }),
    update: vi.fn().mockResolvedValue({
      data: record({ logoFileReference: 'new-document' }, current.version + 1),
    }),
  };
  const documents = {
    uploadMasterDataLogo: vi.fn().mockResolvedValue({
      id: 'new-document',
      reused: false,
      scanStatus: 'PENDING_SCAN',
    }),
    archiveMasterDataLogo: vi.fn().mockResolvedValue(undefined),
  };
  return {
    masterData,
    documents,
    service: new MasterDataLogoService(
      masterData as unknown as MasterDataService,
      documents as unknown as DocumentsService,
    ),
  };
}

describe('MasterDataLogoService', () => {
  it('uploads through Documents and attaches the returned real document id with optimistic version', async () => {
    const { service, masterData, documents } = setup();
    const file = {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      mimetype: 'image/png',
      originalname: 'iran-air.png',
      size: 4,
    };

    const result = await service.replace(
      'airlines',
      record().id,
      { title: 'لوگوی هواپیمایی ایران', version: 3 },
      file,
      actor,
      { ipAddress: '127.0.0.1' },
      actor.branchIds[0],
    );

    expect(documents.uploadMasterDataLogo).toHaveBeenCalledWith(
      expect.objectContaining({
        resource: 'airlines',
        recordId: record().id,
        branchId: actor.branchIds[0],
      }),
      file,
      actor,
      expect.any(Object),
    );
    expect(masterData.update).toHaveBeenCalledWith(
      'airlines',
      record().id,
      { logoFileReference: 'new-document' },
      3,
      actor,
      actor.branchIds[0],
    );
    expect(result.data.attributes.logoFileReference).toBe('new-document');
  });

  it('archives only the previous related logo after replacement', async () => {
    const { service, documents } = setup(
      record({ logoFileReference: 'previous-document' }),
    );

    await service.replace(
      'airlines',
      record().id,
      { title: 'لوگوی جدید', version: 3 },
      {
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        mimetype: 'image/png',
        originalname: 'new.png',
        size: 4,
      },
      actor,
      {},
    );

    expect(documents.archiveMasterDataLogo).toHaveBeenCalledWith(
      {
        documentId: 'previous-document',
        resource: 'airlines',
        recordId: record().id,
      },
      actor,
      {},
    );
  });

  it('rejects unsupported resources and stale versions before uploading', async () => {
    const { service, documents } = setup();
    await expect(
      service.replace(
        'countries',
        record().id,
        { title: 'لوگو', version: 3 },
        undefined,
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.replace(
        'airlines',
        record().id,
        { title: 'لوگو', version: 2 },
        undefined,
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(documents.uploadMasterDataLogo).not.toHaveBeenCalled();
  });

  it('detaches the logo before archiving the exact related document', async () => {
    const { service, masterData, documents } = setup(
      record({ logoFileReference: 'previous-document' }),
    );

    await service.remove('airlines', record().id, 3, actor, {});

    expect(masterData.update).toHaveBeenCalledWith(
      'airlines',
      record().id,
      { logoFileReference: null },
      3,
      actor,
      undefined,
    );
    expect(documents.archiveMasterDataLogo).toHaveBeenCalledWith(
      expect.objectContaining({ documentId: 'previous-document' }),
      actor,
      {},
    );
  });
});
