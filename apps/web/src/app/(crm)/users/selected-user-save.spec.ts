import { describe, expect, it, vi } from 'vitest';
import { saveSelectedUserChanges } from './selected-user-save';
import { manualAccessDraftKey } from './manual-access-draft';

describe('selected user final Save', () => {
  const base = {
    userId: 'legacy-admin',
    branchIds: ['a'],
    originalBranchIds: ['a'],
  };
  it('saves the pending role even when no branch changed', async () => {
    const saveManualAccess = vi.fn(async () => true);
    const request = vi.fn();
    expect(
      await saveSelectedUserChanges({ ...base, saveManualAccess, request }),
    ).toBe(true);
    expect(saveManualAccess).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
  });
  it('never reports success or changes branches when the editor is unavailable or save failed', async () => {
    const request = vi.fn();
    expect(await saveSelectedUserChanges({ ...base, request })).toBe(false);
    expect(
      await saveSelectedUserChanges({
        ...base,
        branchIds: ['b'],
        request,
        saveManualAccess: vi.fn(async () => false),
      }),
    ).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });
  it('uses the fresh server revision after saving a role before changing branches', async () => {
    const order: string[] = [];
    const request = vi.fn(async (path: string, init?: RequestInit) => {
      order.push(path);
      if (!init)
        return [{ id: 'legacy-admin', accessRevision: 'fresh-role-revision' }];
      return {};
    });
    expect(
      await saveSelectedUserChanges({
        ...base,
        branchIds: ['b'],
        request,
        saveManualAccess: async () => {
          order.push('save-role');
          return true;
        },
      }),
    ).toBe(true);
    expect(order).toEqual([
      'save-role',
      '/iam/users',
      '/iam/users/legacy-admin/access',
    ]);
    expect(JSON.parse(request.mock.calls[1]![1]!.body as string)).toEqual({
      accessRevision: 'fresh-role-revision',
      branchIds: ['b'],
    });
  });
  it('surfaces branch revision conflicts rather than inventing success', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce([{ id: 'legacy-admin', accessRevision: 'fresh' }])
      .mockRejectedValueOnce(new Error('Conflict'));
    await expect(
      saveSelectedUserChanges({
        ...base,
        branchIds: ['b'],
        request,
        saveManualAccess: async () => true,
      }),
    ).rejects.toThrow('Conflict');
  });
  it('does not treat reordered grant lists as a dirty legacy snapshot', () => {
    const selection = {
      permissionCodes: ['read', 'write'],
      screenIds: ['system.users'],
      allowedControlIds: ['field'],
    };
    expect(manualAccessDraftKey({ title: 'administrator', selection })).toBe(
      manualAccessDraftKey({
        title: 'administrator',
        selection: { ...selection, permissionCodes: ['write', 'read'] },
      }),
    );
    expect(manualAccessDraftKey({ title: 'full-access', selection })).not.toBe(
      manualAccessDraftKey({ title: 'administrator', selection }),
    );
  });
});
