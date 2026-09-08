import type { AuthenticatedActor, DocumentListItemV1 } from '@rubi/contracts';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentsService } from '../documents/documents.service';
import { B2bAgreementDocuments } from './b2b-agreement-documents';

const actor: AuthenticatedActor = {
  userId: 'user',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: [
    'documents.list',
    'documents.metadata.read',
    'documents.organization.read',
  ],
};
const record = {
  id: 'document',
  branchId: 'branch',
  type: { domain: 'ORGANIZATION' },
  archiveStatus: 'ACTIVE',
  currentVersion: { scanStatus: 'CLEAN' },
  validUntil: null,
  isIncomplete: false,
} as DocumentListItemV1;
function setup(records: DocumentListItemV1[] = [record]) {
  const list = vi
    .fn()
    .mockResolvedValue({ data: records, meta: { totalPages: 1 } });
  return {
    list,
    service: new B2bAgreementDocuments({ list } as unknown as DocumentsService),
  };
}
describe('B2B agreement document reference boundary', () => {
  it('validates through the public Documents source/branch/domain query', async () => {
    const { service, list } = setup();
    await service.assertDraftReference(
      'document',
      'organization',
      'branch',
      actor,
    );
    expect(list).toHaveBeenCalledExactlyOnceWith(
      {
        sourceModule: 'master-data',
        sourceEntityType: 'organizations',
        sourceEntityId: 'organization',
        branchId: 'branch',
        domain: 'ORGANIZATION',
        archiveStatus: 'ACTIVE',
        page: 1,
        pageSize: 100,
      },
      actor,
    );
  });
  it('denies another branch or missing permission before owner lookup', async () => {
    const { service, list } = setup();
    await expect(
      service.assertDraftReference(
        'document',
        'organization',
        'foreign',
        actor,
      ),
    ).rejects.toThrow();
    for (const permission of actor.permissions)
      await expect(
        service.assertDraftReference('document', 'organization', 'branch', {
          ...actor,
          permissions: actor.permissions.filter((item) => item !== permission),
        }),
      ).rejects.toThrow();
    expect(list).not.toHaveBeenCalled();
  });
  it.each([
    'QUARANTINED',
    'PENDING_SCAN',
    'INFECTED',
    'SCAN_FAILED',
    'AWAITING_ANTIVIRUS_ADAPTER',
  ] as const)('rejects %s files', async (scanStatus) => {
    const { service } = setup([
      { ...record, currentVersion: { ...record.currentVersion, scanStatus } },
    ]);
    await expect(
      service.assertDraftReference('document', 'organization', 'branch', actor),
    ).rejects.toThrow('بررسی امنیتی');
  });
  it.each([
    { isIncomplete: true },
    { validUntil: '2000-01-01T00:00:00Z' },
    { branchId: 'foreign' },
    { archiveStatus: 'ARCHIVED' as const },
  ])('rejects unusable or foreign documents %j', async (patch) => {
    const { service } = setup([{ ...record, ...patch }]);
    await expect(
      service.assertDraftReference('document', 'organization', 'branch', actor),
    ).rejects.toThrow();
  });
  it('finds a permitted document on a later page and never accepts an arbitrary UUID', async () => {
    const { service, list } = setup([]);
    list
      .mockResolvedValueOnce({ data: [], meta: { totalPages: 2 } })
      .mockResolvedValueOnce({ data: [record], meta: { totalPages: 2 } });
    await service.assertDraftReference(
      'document',
      'organization',
      'branch',
      actor,
    );
    expect(list).toHaveBeenCalledTimes(2);
    await expect(
      service.assertDraftReference('unknown', 'organization', 'branch', actor),
    ).rejects.toThrow('یافت نشد');
  });
});
