import { describe, it, expect, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { DocumentsService } from './documents.service';
const actor: AuthenticatedActor = {
  userId: 'user',
  sessionId: 'session',
  branchIds: ['branch'],
  permissions: [],
};
function service() {
  return Object.create(DocumentsService.prototype) as DocumentsService;
}
describe('authenticated incoming-letter document boundary', () => {
  it('forces incoming-only lists and leaves the original actor and sensitive domain permissions unchanged', async () => {
    const s = service();
    const list = vi.spyOn(s, 'list').mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    });
    await s.incomingList({ isIncomingLetter: false }, actor);
    expect(list.mock.calls[0]![0].isIncomingLetter).toBe(true);
    expect(list.mock.calls[0]![0].archiveStatus).toBe('ACTIVE');
    expect(list.mock.calls[0]![1].branchIds).toEqual(['branch']);
    expect(list.mock.calls[0]![1].permissions).toContain('documents.list');
    expect(list.mock.calls[0]![1].permissions).not.toContain(
      'documents.hr.read',
    );
    expect(list.mock.calls[0]![1].permissions).not.toContain(
      'documents.sensitive.read',
    );
    expect(actor.permissions).toEqual([]);
  });
  it('forces self-owned incoming uploads for staff without archive upload grants', async () => {
    const s = service();
    const upload = vi
      .spyOn(s, 'upload')
      .mockResolvedValue({ data: {} } as never);
    await s.incomingUpload(
      {
        ownerUserId: 'other',
        branchId: 'branch',
        isIncomingLetter: false,
      } as never,
      undefined,
      actor,
      {},
    );
    expect(upload.mock.calls[0]![0]).toMatchObject({
      ownerUserId: 'user',
      isIncomingLetter: true,
      branchId: 'branch',
    });
  });
  it('limits owner choices for ordinary staff and preserves existing archive-owner grants', async () => {
    const s = service();
    vi.spyOn(s, 'options').mockResolvedValue({
      data: { owners: [{ id: 'user' }, { id: 'other' }] },
    } as never);
    expect(
      (await s.incomingOptions(actor)).data.owners.map((u) => u.id),
    ).toEqual(['user']);
    expect(
      (
        await s.incomingOptions({ ...actor, permissions: ['documents.upload'] })
      ).data.owners.map((u) => u.id),
    ).toEqual(['user', 'other']);
  });
  it('does not allow incoming-file routes to retrieve ordinary archive documents', async () => {
    const s = service();
    const detail = vi.fn().mockResolvedValue({ isIncomingLetter: false });
    Object.assign(s, { repository: { findDetail: detail } });
    const preview = vi.spyOn(s, 'preview').mockResolvedValue({} as never);
    await expect(s.incomingFile('ordinary', actor, {}, true)).rejects.toThrow();
    expect(detail).toHaveBeenCalled();
    expect(preview).not.toHaveBeenCalled();
    detail.mockRejectedValue(new Error('branch denied'));
    await expect(s.incomingFile('foreign', actor, {}, true)).rejects.toThrow(
      'branch denied',
    );
    expect(preview).not.toHaveBeenCalled();
  });
  it('retains the normal file-policy enforcement after confirming incoming classification', async () => {
    const s = service();
    Object.assign(s, {
      repository: {
        findDetail: vi.fn().mockResolvedValue({
          isIncomingLetter: true,
          archiveStatus: 'ACTIVE',
        }),
      },
    });
    const preview = vi
      .spyOn(s, 'preview')
      .mockRejectedValue(new Error('confidential grant required'));
    await expect(
      s.incomingFile(
        'letter',
        actor,
        { confidentialAccessGrantToken: 'grant' },
        true,
      ),
    ).rejects.toThrow('confidential grant required');
    expect(preview.mock.calls[0]![2]).toEqual({
      confidentialAccessGrantToken: 'grant',
    });
  });
});
