import { describe, expect, it, vi } from 'vitest';
import { deleteUserAndReload, deleteRoleAndReload } from './deletion-actions';
describe('confirmed IAM deletion', () => {
  it('sends the current revision and replaces user rows only with verified server data', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ revision: 'r' })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce([{ id: 'other' }]);
    await expect(deleteUserAndReload('target', request)).resolves.toEqual([
      { id: 'other' },
    ]);
    expect(request.mock.calls).toEqual([
      ['/iam/users/target/manual-access'],
      ['/iam/users/target', { method: 'DELETE', headers: { 'If-Match': 'r' } }],
      ['/iam/users'],
    ]);
  });
  it('never claims success if the user remains on the server', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ revision: 'r' })
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce([{ id: 'target' }]);
    await expect(deleteUserAndReload('target', request)).rejects.toThrow(
      'هنوز',
    );
  });
  it('propagates deletion failures without hiding the account or requesting a misleading refresh', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ revision: 'r' })
      .mockRejectedValueOnce(Error('dependent history'));
    await expect(deleteUserAndReload('target', request)).rejects.toThrow(
      'dependent history',
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('rejects missing revision and false success before refreshing', async () => {
    const noRevision = vi.fn().mockResolvedValue({});
    await expect(deleteUserAndReload('target', noRevision)).rejects.toThrow(
      'نسخه',
    );
    expect(noRevision).toHaveBeenCalledTimes(1);
    const request = vi
      .fn()
      .mockResolvedValueOnce({ revision: 'r' })
      .mockResolvedValueOnce({ success: false });
    await expect(deleteUserAndReload('target', request)).rejects.toThrow(
      'تأیید نشد',
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('deletes a role with its shown revision and verifies removal', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce([{ id: 'kept' }]);
    await expect(
      deleteRoleAndReload('role', 'revision', request),
    ).resolves.toEqual([{ id: 'kept' }]);
    expect(request).toHaveBeenNthCalledWith(
      1,
      '/iam/access-options/roles/role',
      { method: 'DELETE', headers: { 'If-Match': 'revision' } },
    );
  });
  it('does not accept a still-present role or a false acknowledgment', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ success: true })
      .mockResolvedValueOnce([{ id: 'role' }]);
    await expect(deleteRoleAndReload('role', 'r', request)).rejects.toThrow(
      'هنوز',
    );
    const failed = vi.fn().mockResolvedValueOnce({ success: false });
    await expect(deleteRoleAndReload('role', 'r', failed)).rejects.toThrow(
      'تأیید نشد',
    );
  });
});
