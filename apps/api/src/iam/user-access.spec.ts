import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import {
  USER_ACCESS_PROFILE_PERMISSION,
  screenPermission,
  type AuthenticatedActor,
} from '@nora/contracts';
import { IamService } from './iam.service';
const actor: AuthenticatedActor = {
  userId: 'operator',
  sessionId: 'session',
  branchIds: [],
  permissions: [
    'iam.users.manage',
    'sales.contracts.read.own',
  ] as AuthenticatedActor['permissions'],
};
function fixture() {
  const memberships = new Map<string, string[]>();
  const grants = new Map<string, string[]>();
  const roles = new Map<string, string>();
  const client = {
    permission: {
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) =>
        where.id.in.map((id) => ({
          id,
          code:
            id === 'read'
              ? 'sales.contracts.read.own'
              : 'system.backup.request',
        })),
      ),
      upsert: vi.fn(async ({ where }: { where: { code: string } }) => ({
        id: where.code,
      })),
    },
    role: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn(async ({ where }: { where: { code: string } }) => {
        roles.set(where.code, where.code);
        return { id: where.code };
      }),
    },
    rolePermission: {
      deleteMany: vi.fn(async ({ where }: { where: { roleId: string } }) => {
        grants.set(where.roleId, []);
      }),
      createMany: vi.fn(
        async ({
          data,
        }: {
          data: Array<{ roleId: string; permissionId: string }>;
        }) => {
          for (const row of data)
            grants.get(row.roleId)!.push(row.permissionId);
        },
      ),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(async ({ data }) => ({
        id: data.id,
        username: data.username,
      })),
      findUnique: vi.fn().mockResolvedValue({ status: 'ACTIVE', roles: [] }),
      count: vi.fn().mockResolvedValue(1),
    },
    userRole: {
      deleteMany: vi.fn(async ({ where }: { where: { userId: string } }) => {
        memberships.set(where.userId, []);
      }),
      createMany: vi.fn(
        async ({
          data,
        }: {
          data: Array<{ userId: string; roleId: string }>;
        }) => {
          for (const row of data) memberships.get(row.userId)!.push(row.roleId);
        },
      ),
    },
    userBranch: { deleteMany: vi.fn(), createMany: vi.fn() },
    auditEvent: { create: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  client.$transaction.mockImplementation(async (callback) => callback(client));
  return {
    client,
    memberships,
    grants,
    service: new IamService({ client } as never, {} as never, {} as never),
  };
}
const access = {
  accessTitle: 'کارشناس فروش',
  permissionIds: ['read'],
  screenIds: ['sales.home'],
  roleIds: [],
  branchIds: [],
};
describe('independent managed user access', () => {
  it('persists selected grants in a user-specific role and removes unchecked grants without changing another user', async () => {
    const f = fixture();
    await f.service.updateUserAccess('first', access, actor, {});
    await f.service.updateUserAccess('second', access, actor, {});
    const other = [...f.grants.get('personal-access-second')!];
    await f.service.updateUserAccess(
      'first',
      { ...access, permissionIds: [], screenIds: [] },
      actor,
      {},
    );
    expect(f.memberships.get('first')).toEqual(['personal-access-first']);
    expect(f.grants.get('personal-access-first')).toEqual([
      USER_ACCESS_PROFILE_PERMISSION,
    ]);
    expect(f.grants.get('personal-access-second')).toEqual(other);
    expect(other).toEqual([
      'read',
      USER_ACCESS_PROFILE_PERMISSION,
      screenPermission('sales.home'),
    ]);
  });
  it('rejects escalation before writing any role or membership', async () => {
    const f = fixture();
    await expect(
      f.service.updateUserAccess(
        'first',
        { ...access, permissionIds: ['backup'] },
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.client.$transaction).not.toHaveBeenCalled();
  });
  it('rejects UI sections outside a managed operator’s own visibility', async () => {
    const f = fixture();
    await expect(
      f.service.updateUserAccess(
        'first',
        access,
        {
          ...actor,
          permissions: [...actor.permissions, USER_ACCESS_PROFILE_PERMISSION],
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(f.client.$transaction).not.toHaveBeenCalled();
  });
  it('lets an active system administrator grant permissions and sections beyond personal grants', async () => {
    const f = fixture();
    f.client.user.findUnique
      .mockResolvedValueOnce({
        roles: [{ role: { code: 'administrator' } }],
      } as never)
      .mockResolvedValueOnce({ status: 'ACTIVE', roles: [] } as never);
    await f.service.updateUserAccess(
      'first',
      { ...access, permissionIds: ['backup'], screenIds: ['system.users'] },
      actor,
      {},
    );
    expect(f.grants.get('personal-access-first')).toContain('backup');
    expect(f.grants.get('personal-access-first')).toContain(
      screenPermission('system.users'),
    );
  });
  it('rejects unknown screen ids and incomplete profiles before mutation', async () => {
    const f = fixture();
    await expect(
      f.service.updateUserAccess(
        'first',
        { ...access, screenIds: ['unknown'] },
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      f.service.updateUserAccess(
        'first',
        { ...access, screenIds: undefined } as never,
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(f.client.$transaction).not.toHaveBeenCalled();
  });
  it('preserves protection of the last active administrator', async () => {
    const f = fixture();
    f.client.role.findUnique.mockResolvedValue({ id: 'admin' } as never);
    f.client.user.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      roles: [{ roleId: 'admin', role: { code: 'administrator' } }],
    } as never);
    await expect(
      f.service.updateUserAccess('first', access, actor, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(f.client.role.upsert).not.toHaveBeenCalled();
    expect(f.client.userRole.deleteMany).not.toHaveBeenCalled();
  });
  it('prevents reuse of a private role through the legacy role assignment API', async () => {
    const f = fixture();
    f.client.role.findMany.mockResolvedValue([
      { id: 'private', code: 'personal-access-second', permissions: [] },
    ] as never);
    await expect(
      f.service.updateUserAccess(
        'first',
        { roleIds: ['private'], branchIds: [] },
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(f.client.$transaction).not.toHaveBeenCalled();
  });
  it('preserves legacy role and branch assignments when no managed fields are supplied', async () => {
    const f = fixture();
    f.client.role.findMany.mockResolvedValue([
      { id: 'legacy', code: 'sales', permissions: [] },
    ] as never);
    await f.service.updateUserAccess(
      'first',
      { roleIds: ['legacy'], branchIds: ['branch'] },
      actor,
      {},
    );
    expect(f.memberships.get('first')).toEqual(['legacy']);
    expect(f.client.userBranch.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'first', branchId: 'branch', isPrimary: true }],
    });
    expect(f.client.role.upsert).not.toHaveBeenCalled();
  });
});

describe('managed account creation', () => {
  it('creates a new account with its own role and hashed password inside one transaction', async () => {
    const f = fixture();
    const result = await f.service.createUser(
      {
        ...access,
        displayName: 'Synthetic user',
        username: 'synthetic-user',
        password: 'Synthetic-Only!42Pass',
      },
      actor,
      {},
    );
    const data = f.client.user.create.mock.calls[0]![0].data;
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(data.passwordHash).not.toBe('Synthetic-Only!42Pass');
    expect(data.roles.create).toEqual([
      { roleId: 'personal-access-' + result.id },
    ]);
    expect(f.grants.get('personal-access-' + result.id)).toEqual([
      'read',
      USER_ACCESS_PROFILE_PERMISSION,
      screenPermission('sales.home'),
    ]);
    expect(f.client.$transaction).toHaveBeenCalledOnce();
  });
});

describe('user creation credential feedback', () => {
  it('reports weak initial password as a validation error rather than an unexpected server error', async () => {
    const f = fixture();
    await expect(
      f.service.createUser(
        {
          ...access,
          username: 'synthetic',
          displayName: 'Synthetic',
          password: 'alllowercase123!',
        },
        actor,
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(f.client.user.create).not.toHaveBeenCalled();
  });
});
