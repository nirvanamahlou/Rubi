import { describe, it, expect, vi } from 'vitest';
import { IamService } from './iam.service';
import { userDetailsRevision } from './user-details';

function setup(authorized = true) {
  const target = {
    id: 'target',
    username: 'legacy',
    displayName: 'Old Name',
    updatedAt: new Date('2026-01-01'),
  };
  const tx = {
    $queryRaw: vi.fn(async () => []),
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({
          status: 'ACTIVE',
          roles: [
            {
              role: {
                isActive: true,
                code: 'staff',
                permissions: authorized
                  ? [{ permission: { code: 'iam.users.manage' } }]
                  : [],
              },
            },
          ],
        })
        .mockResolvedValueOnce(target),
      update: vi.fn(async ({ data }: { data: { displayName: string } }) => ({
        ...target,
        ...data,
        updatedAt: new Date('2026-01-02'),
      })),
    },
    auditEvent: { create: vi.fn(async () => ({})) },
  };
  const service = Object.create(IamService.prototype);
  service.database = {
    client: {
      $transaction: async (callback: (value: typeof tx) => unknown) =>
        callback(tx),
    },
  };
  return {
    service,
    tx,
    target,
    dto: { displayName: ' New Name ', revision: userDetailsRevision(target) },
  };
}
describe('existing user name editing', () => {
  it('updates only the trimmed name and audits in the transaction', async () => {
    const { service, tx, dto } = setup();
    const result = await service.updateUserDetails('target', dto, {
      userId: 'operator',
    });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { displayName: 'New Name' } }),
    );
    expect(tx.auditEvent.create).toHaveBeenCalledOnce();
    expect(result.detailsRevision).not.toBe(dto.revision);
  });
  it('rejects stale changes without writing', async () => {
    const { service, tx, dto } = setup();
    await expect(
      service.updateUserDetails(
        'target',
        { ...dto, revision: 'a'.repeat(64) },
        { userId: 'operator' },
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
  it('rechecks current operator permissions', async () => {
    const { service, tx, dto } = setup(false);
    await expect(
      service.updateUserDetails('target', dto, { userId: 'operator' }),
    ).rejects.toMatchObject({ status: 403 });
    expect(tx.user.update).not.toHaveBeenCalled();
  });
  it('does not rewrite an unchanged name', async () => {
    const { service, tx, dto, target } = setup();
    await service.updateUserDetails(
      'target',
      { ...dto, displayName: target.displayName },
      { userId: 'operator' },
    );
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
  it.each([' ', 'x', 'x'.repeat(161)])(
    'rejects invalid names',
    async (displayName) => {
      const { service, tx, dto } = setup();
      await expect(
        service.updateUserDetails(
          'target',
          { ...dto, displayName },
          { userId: 'operator' },
        ),
      ).rejects.toMatchObject({ status: 400 });
      expect(tx.user.findUnique).not.toHaveBeenCalled();
    },
  );
});
