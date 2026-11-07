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
const oldTeam = {
  ...actor,
  permissions: [
    ...actor.permissions,
    'customer_affairs.call_center.workflow.manage.team',
  ],
} as AuthenticatedActor;
function setup(username = 'ordinary') {
  const user = {
    findFirst: vi.fn().mockResolvedValue({
      id: 'self',
      username,
      profile: { organizationUnitId: 'stale-iam-unit' },
    }),
    findMany: vi
      .fn()
      .mockResolvedValue([{ id: 'self', displayName: 'Account name' }]),
  };
  const tx = { user, $queryRaw: vi.fn().mockResolvedValue([]) };
  const personnel = {
    callCenterRequestTeam: vi.fn().mockResolvedValue(null),
    callCenterStaff: vi
      .fn()
      .mockResolvedValue([
        { userId: 'self', name: 'HR name', position: 'Expert' },
      ]),
  };
  const directory = new IamCallCenterDirectory(
    { client: tx } as never,
    personnel as never,
  );
  return { directory, user, tx, personnel };
}
afterEach(() => vi.unstubAllEnvs());
describe('live HR request assignment authority', () => {
  it.each([actor, oldTeam])(
    'keeps ordinary/demoted staff self-only even with stale manual team grants',
    async (current) => {
      const { directory, user } = setup();
      expect(await directory.requestAssignees(current, 'branch')).toEqual([
        { id: 'self', displayName: 'HR name' },
      ]);
      expect(user.findMany.mock.calls[0]![0].where.id).toBe('self');
    },
  );
  it('grants a current HR manager the exact projected account IDs without a manual team permission', async () => {
    const { directory, user, personnel } = setup();
    personnel.callCenterRequestTeam.mockResolvedValue(['self', 'colleague']);
    await directory.requestAssignees(actor, 'branch');
    expect(user.findMany.mock.calls[0]![0].where).toMatchObject({
      id: { in: ['self', 'colleague'] },
      status: 'ACTIVE',
      b2bOrganizationUser: null,
      branches: { some: { branchId: 'branch', branch: { isActive: true } } },
    });
    expect(user.findMany.mock.calls[0]![0].where.profile).toBeUndefined();
  });
  it('recomputes after promotion, demotion and unit transfer with the same authenticated actor', async () => {
    const { directory, user, personnel } = setup();
    personnel.callCenterRequestTeam
      .mockResolvedValueOnce(['self', 'sales'])
      .mockResolvedValueOnce(['self', 'reservations'])
      .mockResolvedValueOnce(null);
    for (let i = 0; i < 3; i++)
      await directory.requestAssignees(oldTeam, 'branch');
    expect(user.findMany.mock.calls.map((c) => c[0].where.id)).toEqual([
      { in: ['self', 'sales'] },
      { in: ['self', 'reservations'] },
      'self',
    ]);
  });
  it('ignores callback/global triage privileges for a non-executive manager', async () => {
    const { directory, user, personnel } = setup('unit-manager');
    vi.spyOn(directory, 'globalCallCenter').mockResolvedValue(true);
    personnel.callCenterRequestTeam.mockResolvedValue(['self', 'peer']);
    await directory.requestAssignees(actor, 'branch');
    expect(user.findMany.mock.calls[0]![0].where.id).toEqual({
      in: ['self', 'peer'],
    });
  });
  it.each(['demo', 'claimed-director'])(
    'does not infer executive authority from configured %s',
    async (username) => {
      vi.stubEnv(
        'CALL_CENTER_REQUEST_GLOBAL_USERNAMES',
        'demo,claimed-director',
      );
      const { directory, user } = setup(username);
      await directory.requestAssignees(actor, 'branch');
      expect(user.findMany.mock.calls[0]![0].where.id).toBe('self');
    },
  );
  it('preserves verified executive choices and labels', async () => {
    vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
    const { directory, user, personnel } = setup('danial');
    vi.spyOn(directory, 'globalCallCenter').mockResolvedValue(true);
    expect(await directory.requestAssignees(actor, 'branch')).toEqual([
      {
        id: 'self',
        displayName: 'HR name',
        position: 'Expert',
        showPosition: true,
      },
    ]);
    expect(user.findMany.mock.calls[0]![0].where.id).toBeUndefined();
    expect(personnel.callCenterRequestTeam).not.toHaveBeenCalled();
  });
  it('rejects foreign branches and missing route/workflow gates before HR reads', async () => {
    const { directory, personnel } = setup();
    for (const current of [
      actor,
      { ...actor, permissions: [] },
    ] as AuthenticatedActor[])
      await expect(
        directory.requestAssignees(
          current,
          current === actor ? 'other' : 'branch',
        ),
      ).rejects.toThrow();
    expect(personnel.callCenterRequestTeam).not.toHaveBeenCalled();
  });
  it('requires an active native account', async () => {
    const { directory, user, personnel } = setup();
    user.findFirst.mockResolvedValue(null);
    await expect(directory.requestAssignees(actor, 'branch')).rejects.toThrow();
    expect(personnel.callCenterRequestTeam).not.toHaveBeenCalled();
  });
  it('revalidates HR authority at save so stale choices after demotion are rejected', async () => {
    const { directory, personnel, user, tx } = setup();
    personnel.callCenterRequestTeam
      .mockResolvedValueOnce(['self', 'peer'])
      .mockResolvedValueOnce(null);
    user.findMany.mockImplementation(
      async (q: { where: { id: string | { in: string[] } } }) =>
        [{ id: 'peer', displayName: 'Peer' }].filter((x) =>
          typeof q.where.id === 'string'
            ? x.id === q.where.id
            : q.where.id.in.includes(x.id),
        ),
    );
    expect(await directory.requestAssignees(actor, 'branch')).toHaveLength(1);
    await expect(
      directory.resolveRequestAssignee(tx as never, oldTeam, 'branch', 'peer'),
    ).rejects.toThrow('خارج از محدوده');
    expect(personnel.callCenterRequestTeam).toHaveBeenLastCalledWith(
      'branch',
      'self',
      tx,
    );
  });
  it('accepts same-unit recipients and rejects forged foreign-unit recipients at save', async () => {
    const { directory, personnel, user, tx } = setup();
    personnel.callCenterRequestTeam.mockResolvedValue(['self', 'peer']);
    user.findMany.mockResolvedValue([{ id: 'peer', displayName: 'Peer' }]);
    await expect(
      directory.resolveRequestAssignee(tx as never, actor, 'branch', 'peer'),
    ).resolves.toMatchObject({ id: 'peer' });
    await expect(
      directory.resolveRequestAssignee(tx as never, actor, 'branch', 'foreign'),
    ).rejects.toThrow('خارج از محدوده');
    expect(tx.$queryRaw).toHaveBeenCalledTimes(6);
  });
  it('uses the same live HR membership for management fields and revokes demoted managers', async () => {
    const { directory, personnel } = setup();
    personnel.callCenterRequestTeam.mockResolvedValue(['self', 'peer']);
    expect(await directory.canManageRequest(actor, 'branch', 'peer')).toBe(
      true,
    );
    expect(await directory.canManageRequest(actor, 'branch', 'foreign')).toBe(
      false,
    );
    personnel.callCenterRequestTeam.mockResolvedValue(null);
    expect(await directory.canManageRequest(oldTeam, 'branch', 'peer')).toBe(
      false,
    );
    expect(await directory.canManageRequest(actor, 'other', 'peer')).toBe(
      false,
    );
  });
  it('does not invent HR names for unlinked accounts', async () => {
    const { directory, personnel } = setup();
    personnel.callCenterStaff.mockResolvedValue([]);
    expect(await directory.requestAssignees(actor, 'branch')).toEqual([
      { id: 'self', displayName: 'Account name' },
    ]);
  });
});

const managerId = '00000000-0000-4000-8000-000000000010';
const extraId = '00000000-0000-4000-8000-000000000020';
describe('explicit additional request assignees', () => {
  function policy() {
    vi.stubEnv(
      'CALL_CENTER_REQUEST_EXTRA_ASSIGNEES',
      JSON.stringify({ [managerId]: [extraId] }),
    );
    vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
    return { ...actor, userId: managerId } as AuthenticatedActor;
  }
  it('adds only configured targets while retaining active internal branch guards', async () => {
    const manager = policy();
    const { directory, user, personnel } = setup();
    personnel.callCenterRequestTeam.mockResolvedValue([managerId]);
    await directory.requestAssignees(manager, 'branch');
    expect(user.findMany.mock.calls[0]![0].where).toMatchObject({
      id: { in: [managerId, extraId] },
      status: 'ACTIVE',
      b2bOrganizationUser: null,
      branches: { some: { branchId: 'branch', branch: { isActive: true } } },
    });
  });
  it('does not extend a different manager or ordinary account', async () => {
    policy();
    const { directory, user } = setup();
    await directory.requestAssignees(actor, 'branch');
    expect(user.findMany.mock.calls[0]![0].where.id).toBe(actor.userId);
  });
  it('authorizes management only for an eligible configured target', async () => {
    const manager = policy();
    const { directory, user, personnel } = setup();
    personnel.callCenterRequestTeam.mockResolvedValue([managerId]);
    user.findFirst
      .mockResolvedValueOnce({ username: 'manager', profile: null })
      .mockResolvedValueOnce({ id: extraId });
    expect(await directory.canManageRequest(manager, 'branch', extraId)).toBe(
      true,
    );
    expect(user.findFirst.mock.calls[1]![0].where).toMatchObject({
      id: extraId,
      status: 'ACTIVE',
      b2bOrganizationUser: null,
      branches: { some: { branchId: 'branch', branch: { isActive: true } } },
    });
  });
  it('denies an inactive, external or foreign-branch configured target', async () => {
    const manager = policy();
    const { directory, user, personnel } = setup();
    personnel.callCenterRequestTeam.mockResolvedValue([managerId]);
    user.findFirst
      .mockResolvedValueOnce({ username: 'manager', profile: null })
      .mockResolvedValueOnce(null);
    expect(await directory.canManageRequest(manager, 'branch', extraId)).toBe(
      false,
    );
    expect(await directory.canManageRequest(manager, 'other', extraId)).toBe(
      false,
    );
  });
  it('removes the configured exception immediately after HR manager authority ends', async () => {
    const manager = policy();
    const { directory, user } = setup();
    await directory.requestAssignees(manager, 'branch');
    expect(user.findMany.mock.calls[0]![0].where.id).toBe(managerId);
    expect(await directory.canManageRequest(manager, 'branch', extraId)).toBe(
      false,
    );
  });
  it.each(['{', '[]', 'null', JSON.stringify({ [managerId]: ['invalid'] })])(
    'fails closed for malformed policy %s',
    async (value) => {
      vi.stubEnv('CALL_CENTER_REQUEST_EXTRA_ASSIGNEES', value);
      const { directory, user } = setup();
      await directory.requestAssignees(
        { ...actor, userId: managerId },
        'branch',
      );
      expect(user.findMany.mock.calls[0]![0].where.id).toBe(managerId);
    },
  );
});

import { CallCenterAccessService } from '../customer-affairs/call-center-access.service';
it('keeps creator access limited to their configured-target requests, without exposing contact history', async () => {
  vi.stubEnv(
    'CALL_CENTER_REQUEST_EXTRA_ASSIGNEES',
    JSON.stringify({ [managerId]: [extraId] }),
  );
  const accounts = {
    additionalRequestAssigneeIds: vi.fn().mockResolvedValue([extraId]),
  };
  const access = new CallCenterAccessService(
    {} as never,
    {} as never,
    accounts as never,
  );
  vi.spyOn(access, 'users').mockResolvedValue([managerId]);
  vi.spyOn(access, 'where').mockResolvedValue({ id: 'visible-contact' });
  vi.spyOn(access, 'canReviewCreatedRequest').mockResolvedValue(false);
  const where = await access.requestWhere(
    { ...actor, userId: managerId },
    'branch',
  );
  expect(where.branchId).toBe('branch');
  expect(where.OR).toContainEqual({
    createdByUserId: managerId,
    executionOwnerUserId: { in: [extraId] },
  });
  expect(where.OR).toContainEqual(
    expect.objectContaining({ callCenterContact: { id: 'visible-contact' } }),
  );
});
