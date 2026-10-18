import { describe, expect, it, vi } from 'vitest';
import { IamService } from './iam.service';
import { isPrivateUserRole, roleDirectoryRevision } from './role-directory';
function setup() {
  const role = {
    id: 'role',
    code: 'personal-access-template-job-test',
    name: 'Custom',
    isActive: true,
    isSystem: false,
    updatedAt: new Date('2026-10-18T00:00:00Z'),
    users: [] as Array<{ userId: string }>,
    permissions: [{ permissionId: 'p' }],
  };
  const operator = {
    status: 'ACTIVE',
    roles: [
      {
        role: {
          id: 'admin-role',
          code: 'administrator',
          name: 'Admin',
          isActive: true,
          permissions: [{ permission: { code: 'iam.users.manage' } }],
        },
      },
    ],
  };
  const tx = {
    $queryRaw: vi.fn(async () => []),
    user: { findUnique: vi.fn(async () => operator) },
    role: {
      findUnique: vi.fn(async () => role),
      delete: vi.fn(async () => role),
      findMany: vi.fn(async () => [role]),
    },
    auditEvent: { create: vi.fn(async () => ({})) },
  };
  const service = Object.create(IamService.prototype);
  service.database = {
    client: {
      ...tx,
      $transaction: vi.fn(async (fn: (tx: object) => unknown) => fn(tx)),
    },
  };
  service.isSystemAdministrator = vi.fn(async () => true);
  const actor = {
    userId: 'admin',
    permissions: ['iam.users.manage'],
    branchIds: [],
    sessionId: 's',
  };
  return {
    service,
    role,
    operator,
    tx,
    actor,
    revision: () => roleDirectoryRevision(role),
  };
}
describe('role directory and permanent deletion', () => {
  it('lists existing roles with protections, revision and user count', async () => {
    const { service, role, actor, revision } = setup();
    const rows = await service.listRoleDirectory(actor);
    expect(rows[0]).toMatchObject({
      id: role.id,
      canDelete: true,
      userCount: 0,
      isTemplate: true,
      revision: revision(),
    });
    role.users.push({ userId: 'existing-user' });
    expect((await service.listRoleDirectory(actor))[0].canDelete).toBe(false);
    expect((await service.listRoleDirectory(actor))[0]).not.toHaveProperty(
      'users',
    );
  });
  it('permanently deletes only the selected unassigned custom role and audits atomically', async () => {
    const { service, actor, revision, tx } = setup();
    await expect(
      service.deleteRole('role', revision(), actor),
    ).resolves.toEqual({ success: true });
    expect(tx.role.delete).toHaveBeenCalledWith({ where: { id: 'role' } });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'iam.role.delete',
        entityId: 'role',
        actorUserId: 'admin',
      }),
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
  });
  it.each([
    'administrator',
    'personal-access-user-id',
    'manual-access-v3-user-id',
  ])('protects reserved role %s even if isSystem was false', async (code) => {
    const { service, role, actor, revision, tx } = setup();
    role.code = code;
    await expect(service.deleteRole('role', revision(), actor)).rejects.toThrow(
      'سیستمی',
    );
    expect(tx.role.delete).not.toHaveBeenCalled();
  });
  it('protects system roles and memberships including inactive user assignments', async () => {
    const { service, role, actor, revision, tx } = setup();
    role.isSystem = true;
    await expect(service.deleteRole('role', revision(), actor)).rejects.toThrow(
      'سیستمی',
    );
    role.isSystem = false;
    role.users = [{ userId: 'inactive-account' }];
    await expect(service.deleteRole('role', revision(), actor)).rejects.toThrow(
      'متصل',
    );
    expect(tx.role.delete).not.toHaveBeenCalled();
  });
  it('rejects changed revisions and missing revisions without mutations', async () => {
    const { service, actor, tx } = setup();
    await expect(service.deleteRole('role', '', actor)).rejects.toThrow('نسخه');
    await expect(
      service.deleteRole('role', 'a'.repeat(64), actor),
    ).rejects.toThrow('تغییر کرده');
    expect(tx.role.delete).not.toHaveBeenCalled();
    expect(tx.auditEvent.create).not.toHaveBeenCalled();
  });
  it('rechecks live administrative authority before reading/deleting a role', async () => {
    const { service, operator, actor, revision, tx } = setup();
    operator.roles = [];
    await expect(service.deleteRole('role', revision(), actor)).rejects.toThrow(
      'مدیر',
    );
    expect(tx.role.findUnique).not.toHaveBeenCalled();
    expect(tx.role.delete).not.toHaveBeenCalled();
    service.isSystemAdministrator.mockResolvedValue(false);
    await expect(service.listRoleDirectory(actor)).rejects.toThrow();
  });
  it('fingerprints membership and grant changes, excludes private accounts but not templates', () => {
    const { role, revision } = setup();
    const before = revision();
    role.users.push({ userId: 'u' });
    expect(revision()).not.toBe(before);
    expect(isPrivateUserRole('manual-access-v3-u')).toBe(true);
    expect(isPrivateUserRole('personal-access-u')).toBe(true);
    expect(isPrivateUserRole(role.code)).toBe(false);
  });
});
