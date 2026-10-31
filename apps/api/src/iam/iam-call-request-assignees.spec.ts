import { afterEach, describe, expect, it, vi } from 'vitest';
import { IamCallCenterDirectory } from './iam-call-center-directory';
import type { AuthenticatedActor } from '@nora/contracts';

const actor = {
  userId: 'self',
  branchIds: ['branch'],
  permissions: [
    'customer_affairs.call_center.read',
    'customer_affairs.call_center.workflow.manage',
  ],
} as AuthenticatedActor;
function setup(username = 'ordinary', unitBranch = 'branch') {
  const account = {
    username,
    profile: {
      organizationUnitId: 'unit-a',
      organizationUnit: {
        branchId: unitBranch,
        status: 'فعال',
        deletedAt: null,
      },
    },
  };
  const user = {
    findFirst: vi.fn().mockResolvedValue(account),
    findMany: vi
      .fn()
      .mockResolvedValue([{ id: 'self', displayName: 'Short name' }]),
  };
  const tx = { user, $queryRaw: vi.fn().mockResolvedValue([]) };
  const personnel = {
    callCenterUnit: vi.fn().mockResolvedValue(unitBranch === 'branch'),
    callCenterStaff: vi
      .fn()
      .mockResolvedValue([
        { userId: 'self', name: 'Full employee name', position: 'Sales agent' },
      ]),
  };
  const directory = new IamCallCenterDirectory(
    { client: tx } as never,
    personnel as never,
  );
  return { directory, user, personnel, tx };
}
afterEach(() => vi.unstubAllEnvs());
describe('request assignee organizational authorization', () => {
  it('restricts ordinary and legacy broad accounts to self, with HR full name', async () => {
    const { directory, user } = setup();
    expect(await directory.requestAssignees(actor, 'branch')).toEqual([
      { id: 'self', displayName: 'Full employee name' },
    ]);
    expect(user.findMany.mock.calls[0]![0].where).toMatchObject({
      id: 'self',
      status: 'ACTIVE',
      b2bOrganizationUser: null,
      branches: { some: { branchId: 'branch', branch: { isActive: true } } },
    });
  });
  it('uses exact organization ID for managers, never a department name', async () => {
    const { directory, user } = setup();
    await directory.requestAssignees(
      {
        ...actor,
        permissions: [
          ...actor.permissions,
          'customer_affairs.call_center.workflow.manage.team',
        ],
      },
      'branch',
    );
    expect(user.findMany.mock.calls[0]![0].where.profile).toEqual({
      organizationUnitId: 'unit-a',
    });
    expect(user.findMany.mock.calls[0]![0].where.id).toBeUndefined();
  });
  it('fails closed when a manager unit is from another branch', async () => {
    const { directory, user } = setup('manager', 'other');
    await directory.requestAssignees(
      {
        ...actor,
        permissions: [
          ...actor.permissions,
          'customer_affairs.call_center.workflow.manage.team',
        ],
      },
      'branch',
    );
    expect(user.findMany.mock.calls[0]![0].where.id).toBe('self');
  });
  it.each(['executive-test', 'demo-test'])(
    'allows explicitly configured %s and returns position',
    async (username) => {
      vi.stubEnv(
        'CALL_CENTER_REQUEST_GLOBAL_USERNAMES',
        'executive-test,demo-test',
      );
      const { directory, user } = setup(username);
      expect(await directory.requestAssignees(actor, 'branch')).toEqual([
        {
          id: 'self',
          displayName: 'Full employee name',
          position: 'Sales agent',
          showPosition: true,
        },
      ]);
      expect(user.findMany.mock.calls[0]![0].where.id).toBeUndefined();
      expect(user.findMany.mock.calls[0]![0].where.profile).toBeUndefined();
    },
  );
  it('requires a real active authenticated account, not a claimed username', async () => {
    const { directory, user } = setup();
    user.findFirst.mockResolvedValue(null);
    await expect(directory.requestAssignees(actor, 'branch')).rejects.toThrow();
    expect(user.findMany).not.toHaveBeenCalled();
  });
  it('denies foreign branches before querying identities', async () => {
    const { directory, user } = setup();
    await expect(directory.requestAssignees(actor, 'other')).rejects.toThrow();
    expect(user.findFirst).not.toHaveBeenCalled();
  });
  it('rejects forged recipients at save time and locks account membership', async () => {
    const { directory, tx } = setup();
    await expect(
      directory.resolveRequestAssignee(
        tx as never,
        actor,
        'branch',
        'foreign-user',
      ),
    ).rejects.toThrow('خارج از محدوده');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(
      await directory.resolveRequestAssignee(
        tx as never,
        actor,
        'branch',
        'self',
      ),
    ).toMatchObject({ id: 'self' });
  });
  it('does not invent job titles when personnel records are absent', async () => {
    vi.stubEnv('CALL_CENTER_REQUEST_GLOBAL_USERNAMES', 'executive-test');
    const { directory, personnel } = setup('executive-test');
    personnel.callCenterStaff.mockResolvedValue([]);
    expect(await directory.requestAssignees(actor, 'branch')).toEqual([
      {
        id: 'self',
        displayName: 'Short name',
        position: null,
        showPosition: true,
      },
    ]);
  });
});

it('denies management fields to ordinary staff even on their own request', async () => {
  const { directory } = setup();
  expect(await directory.canManageRequest(actor, 'branch', 'self')).toBe(false);
});
it('allows only a manager of the responsible employee unit', async () => {
  const { directory, user } = setup();
  const manager: AuthenticatedActor = {
    ...actor,
    permissions: [
      ...actor.permissions,
      'customer_affairs.call_center.workflow.manage.team',
    ],
  };
  expect(await directory.canManageRequest(manager, 'branch', 'employee')).toBe(
    true,
  );
  user.findFirst
    .mockResolvedValueOnce({
      username: 'manager',
      profile: { organizationUnitId: 'unit-a' },
    })
    .mockResolvedValueOnce({ profile: { organizationUnitId: 'unit-b' } });
  expect(await directory.canManageRequest(manager, 'branch', 'employee')).toBe(
    false,
  );
  expect(await directory.canManageRequest(manager, 'other', 'employee')).toBe(
    false,
  );
});
it('preserves only explicitly configured global authority', async () => {
  vi.stubEnv('CALL_CENTER_REQUEST_GLOBAL_USERNAMES', 'danial,demo');
  const { directory } = setup('danial');
  expect(await directory.canManageRequest(actor, 'branch', null)).toBe(true);
});
