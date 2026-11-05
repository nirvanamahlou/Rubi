import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { DocumentsService } from './documents.service';
const actor = {
  userId: 'owner',
  branchIds: ['branch'],
  permissions: [],
} as unknown as AuthenticatedActor;
function setup() {
  const row = {
    id: 'doc',
    ownerUserId: 'owner',
    branchId: 'branch',
    sourceModule: 'HUMAN_RESOURCES',
    sourceEntityType: 'LeaveEvidence',
    sourceEntityId: 'owner',
    confidentiality: 'RESTRICTED',
    deletedAt: null,
    archiveStatus: 'ACTIVE',
  };
  const repository = {
    findDetail: vi.fn().mockResolvedValue(row),
    options: vi.fn().mockResolvedValue({
      documentTypes: [{ id: 'type', code: 'HR_DOCUMENT' }],
      categories: [{ id: 'category', code: 'GENERAL_ARCHIVE' }],
    }),
  };
  const service = new DocumentsService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return { service, repository, row };
}
describe('private leave evidence boundary', () => {
  it('accepts only the exact owner, branch and leave source', async () => {
    const { service, row } = setup();
    await expect(
      service.assertLeaveEvidence(['doc'], 'branch', 'owner'),
    ).resolves.toBeUndefined();
    for (const patch of [
      { ownerUserId: 'other' },
      { branchId: 'other' },
      { sourceModule: 'SALES' },
      { sourceEntityType: 'Other' },
      { confidentiality: 'INTERNAL' },
      { archiveStatus: 'ARCHIVED' },
    ]) {
      const before = { ...row };
      Object.assign(row, patch);
      await expect(
        service.assertLeaveEvidence(['doc'], 'branch', 'owner'),
      ).rejects.toThrow();
      Object.assign(row, before);
    }
    await expect(
      service.assertLeaveEvidence(['doc', 'doc'], 'branch', 'owner'),
    ).rejects.toThrow();
  });
  it('uploads with fixed private HR metadata and an explicit expiry without persisting elevated privileges', async () => {
    const { service } = setup();
    const upload = vi
      .spyOn(service, 'upload')
      .mockResolvedValue({ data: { id: 'doc' } } as never);
    await service.uploadLeaveEvidence(
      'branch',
      '2026-11-07',
      {
        originalname: 'medical.pdf',
        mimetype: 'application/pdf',
        size: 5,
        buffer: Buffer.from('%PDF-'),
      },
      actor,
      {},
    );
    expect(upload).toHaveBeenCalledWith(
      expect.objectContaining({
        validUntil: '2026-11-07',
        ownerUserId: 'owner',
        confidentiality: 'RESTRICTED',
        sourceEntityType: 'LeaveEvidence',
      }),
      expect.anything(),
      expect.anything(),
      {},
    );
    expect(actor.permissions).toEqual([]);
    await expect(
      service.uploadLeaveEvidence('other', '2026-11-07', undefined, actor, {}),
    ).rejects.toThrow();
  });
});
