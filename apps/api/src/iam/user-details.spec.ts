import { describe, it, expect, vi } from 'vitest';
import { IamService } from './iam.service';
import { userDetailsRevision } from './user-details';

function setup(authorized = true, unitId: string | null = null) {
  const target = {
    id: 'target',
    username: 'legacy',
    displayName: 'Old Name',
    updatedAt: new Date('2026-01-01'),
    profile: { organizationUnitId: unitId },
    branches: [{ branchId: 'branch' }],
  };
  const tx = {
    $queryRaw: vi.fn(async () => []),
    user: {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({
          status: 'ACTIVE',
          branches: [{ branchId: 'branch' }],
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
    iamUserProfile: {
      upsert: vi.fn(
        async ({
          update,
        }: {
          update: { organizationUnitId: string | null };
        }) => {
          target.profile.organizationUnitId = update.organizationUnitId;
          return target.profile;
        },
      ),
    },
  };
  const service = Object.create(IamService.prototype);
  service.units = {
    assertAssignable: vi.fn(async () => ({ id: 'unit', branchId: 'branch' })),
  };
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
  it('assigns a unit atomically without changing grants or employee records', async () => {
    const { service, tx, dto, target } = setup();
    const result = await service.updateUserDetails(
      'target',
      { ...dto, displayName: target.displayName, organizationUnitId: 'unit' },
      { userId: 'operator' },
    );
    expect(service.units.assertAssignable).toHaveBeenCalledWith(
      tx,
      'unit',
      expect.objectContaining({ branchIds: ['branch'] }),
      ['branch'],
    );
    expect(tx.iamUserProfile.upsert).toHaveBeenCalledWith({
      where: { userId: 'target' },
      create: { userId: 'target', organizationUnitId: 'unit' },
      update: { organizationUnitId: 'unit' },
    });
    expect(tx.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { displayName: 'Old Name' } }),
    );
    expect(result.organizationUnitId).toBe('unit');
    expect(tx.auditEvent.create).toHaveBeenCalledOnce();
  });
  it('clears only the explicit unit field and preserves unrelated profile properties', async () => {
    const { service, tx, dto } = setup(true, 'old-unit');
    await service.updateUserDetails(
      'target',
      { ...dto, organizationUnitId: null },
      { userId: 'operator' },
    );
    expect(service.units.assertAssignable).not.toHaveBeenCalled();
    expect(tx.iamUserProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { organizationUnitId: null } }),
    );
  });
  it('preserves an existing unit on a name-only save', async () => {
    const { service, tx, dto } = setup(true, 'old-unit');
    await service.updateUserDetails('target', dto, { userId: 'operator' });
    expect(tx.iamUserProfile.upsert).not.toHaveBeenCalled();
    expect(service.units.assertAssignable).not.toHaveBeenCalled();
  });
  it('rejects an unavailable unit before writing name or profile', async () => {
    const { service, tx, dto } = setup();
    service.units.assertAssignable.mockRejectedValue(
      new Error('Unavailable unit'),
    );
    await expect(
      service.updateUserDetails(
        'target',
        { ...dto, organizationUnitId: 'unit' },
        { userId: 'operator' },
      ),
    ).rejects.toThrow('Unavailable unit');
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.iamUserProfile.upsert).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
  it('changes the revision when only the assigned unit changes', () => {
    const { target } = setup();
    const oldRevision = userDetailsRevision(target);
    target.profile.organizationUnitId = 'unit';
    expect(userDetailsRevision(target)).not.toBe(oldRevision);
  });
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
