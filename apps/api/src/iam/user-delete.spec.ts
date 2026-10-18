import { describe, expect, it, vi } from 'vitest';
import { ManualUserAccessService } from './manual-user-access.service';
import { manualAccessRevision } from './manual-access-policy';
import type { AuthenticatedActor } from '@nora/contracts';
const adminRole = {
  role: {
    id: 'admin-role',
    code: 'administrator',
    name: 'Administrator',
    isActive: true,
    permissions: ['iam.users.read', 'iam.users.manage'].map((code) => ({
      permission: { code },
    })),
  },
};
function setup() {
  const operator = {
    id: 'actor',
    status: 'ACTIVE',
    roles: [adminRole],
    branches: [],
  };
  const target = {
    id: 'target',
    status: 'ACTIVE',
    roles: [],
    branches: [],
    _count: { roles: 1, branches: 1, sessions: 2 },
    hrEmployee: null as object | null,
    b2bOrganizationUser: null,
  };
  const tx = {
    $queryRaw: vi.fn(async () => []),
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) =>
        where.id === 'actor' ? operator : target,
      ),
      findMany: vi.fn(async () => [operator, target]),
      delete: vi.fn(async () => target),
    },
    b2bOrganizationUser: { findUnique: vi.fn(async () => null) },
    auditEvent: { create: vi.fn(async () => ({})) },
  };
  const db = {
    client: {
      $transaction: vi.fn(async (callback: (tx: object) => unknown) =>
        callback(tx),
      ),
    },
  };
  const service = new ManualUserAccessService(db as never);
  const actor = {
    userId: 'actor',
    permissions: ['iam.users.manage'],
    branchIds: [],
    sessionId: 'session',
  } as AuthenticatedActor;
  return {
    operator,
    target,
    tx,
    service,
    actor,
    revision: () =>
      manualAccessRevision({ ...target, b2bOrganizationUser: null }),
  };
}
describe('safe permanent user deletion', () => {
  it('protects the last active administrator', async () => {
    const { service, actor, revision, tx, target } = setup();
    Object.assign(target, { roles: [adminRole] });
    tx.user.findMany.mockResolvedValue([target]);
    await expect(service.delete('target', revision(), actor)).rejects.toThrow(
      'آخرین مدیر',
    );
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
  it('deletes an unreferenced account and writes audit inside the same transaction', async () => {
    const { service, actor, revision, tx } = setup();
    await expect(service.delete('target', revision(), actor)).resolves.toEqual({
      success: true,
    });
    expect(tx.user.delete).toHaveBeenCalledWith({ where: { id: 'target' } });
    expect(tx.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actorUserId: 'actor',
        action: 'iam.user.delete',
        entityId: 'target',
      }),
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });
  it('rejects self deletion and missing revision without writes', async () => {
    const { service, actor, revision, tx } = setup();
    await expect(service.delete('actor', revision(), actor)).rejects.toThrow(
      'حساب جاری',
    );
    await expect(service.delete('target', '', actor)).rejects.toThrow('نسخه');
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
  it('requires a live canonical administrator rather than a forged actor marker', async () => {
    const { service, actor, revision, tx, operator } = setup();
    operator.roles = [];
    await expect(service.delete('target', revision(), actor)).rejects.toThrow(
      'مدیر سامانه',
    );
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
  it('rejects stale access before any destructive write', async () => {
    const { service, actor, tx } = setup();
    await expect(
      service.delete('target', '0'.repeat(64), actor),
    ).rejects.toThrow('تغییر کرده');
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
  it.each([
    'documentsOwned',
    'auditEvents',
    'financeRequestsCreated',
    'futureRelation',
  ])(
    'protects dependent history %s even for cascading FKs',
    async (relation) => {
      const { service, actor, revision, tx, target } = setup();
      Object.assign(target._count, { [relation]: 1 });
      await expect(service.delete('target', revision(), actor)).rejects.toThrow(
        'سابقه',
      );
      expect(tx.user.delete).not.toHaveBeenCalled();
      expect(tx.auditEvent.create).not.toHaveBeenCalled();
    },
  );
  it('protects singular employee and agency references', async () => {
    const { service, actor, revision, tx, target } = setup();
    target.hrEmployee = { id: 'employee' };
    await expect(service.delete('target', revision(), actor)).rejects.toThrow(
      'سابقه',
    );
    expect(tx.user.delete).not.toHaveBeenCalled();
  });
});
