import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { CallCenterAccessService } from './call-center-access.service';
import { IamCallCenterDirectory } from '../iam/iam-call-center-directory';
const actor = {
  userId: 'manager',
  branchIds: ['branch'],
  permissions: [
    'customer_affairs.call_center.read',
    'customer_affairs.call_center.contacts.read.own',
    'customer_affairs.call_center.reports.read.own',
  ],
} as AuthenticatedActor;
function setup() {
  const user = {
    findFirst: vi.fn().mockResolvedValue({ id: 'manager' }),
    findMany: vi.fn().mockResolvedValue([{ id: 'manager' }, { id: 'expert' }]),
  };
  const personnel = {
    callCenterRequestTeam: vi.fn().mockResolvedValue(['manager', 'expert']),
  };
  const accounts = new IamCallCenterDirectory(
    { client: { user } } as never,
    personnel as never,
  );
  vi.spyOn(accounts, 'globalCallCenter').mockResolvedValue(false);
  const directory = {
    callCenterOperator: vi.fn().mockResolvedValue(undefined),
    callCenterTeam: vi.fn().mockResolvedValue(['legacy-foreign']),
  };
  const access = new CallCenterAccessService(
    { client: { user } } as never,
    directory as never,
    accounts,
  );
  return { user, personnel, accounts, directory, access };
}
afterEach(() => vi.unstubAllEnvs());
describe('native HR manager call read scope', () => {
  it.each(['contacts', 'reports'] as const)(
    'uses current HR team for %s with only own-read grants',
    async (purpose) => {
      vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
      const { access, directory, personnel, user } = setup();
      expect(await access.users(actor, 'branch', purpose)).toEqual([
        'manager',
        'expert',
      ]);
      expect(directory.callCenterTeam).not.toHaveBeenCalled();
      expect(personnel.callCenterRequestTeam).toHaveBeenCalledWith(
        'branch',
        'manager',
        undefined,
      );
      expect(user.findMany.mock.calls[0]![0].where).toMatchObject({
        id: { in: ['manager', 'expert'] },
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        branches: { some: { branchId: 'branch', branch: { isActive: true } } },
      });
    },
  );
  it('does not use stale team grants after demotion or when HR has no eligible unit', async () => {
    vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
    const { access, personnel, user } = setup();
    personnel.callCenterRequestTeam.mockResolvedValue(null);
    const stale = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'customer_affairs.call_center.contacts.read.team',
      ],
    } as AuthenticatedActor;
    expect(await access.users(stale, 'branch', 'contacts')).toEqual([
      'manager',
    ]);
    expect(user.findMany).not.toHaveBeenCalled();
  });
  it('recomputes transferred team without modifying the authenticated actor', async () => {
    vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
    const { access, personnel, user } = setup();
    await access.users(actor, 'branch', 'contacts');
    personnel.callCenterRequestTeam.mockResolvedValue([
      'manager',
      'new-unit-expert',
    ]);
    user.findMany.mockResolvedValue([
      { id: 'manager' },
      { id: 'new-unit-expert' },
    ]);
    expect(await access.users(actor, 'branch', 'contacts')).toEqual([
      'manager',
      'new-unit-expert',
    ]);
    expect(actor.permissions).not.toContain(
      'customer_affairs.call_center.contacts.read.team',
    );
  });
  it('rejects foreign branch, missing route/read, inactive or external manager accounts', async () => {
    const { accounts, user, personnel } = setup();
    expect(await accounts.managedReadUsers(actor, 'foreign')).toEqual([]);
    expect(
      await accounts.managedReadUsers({ ...actor, permissions: [] }, 'branch'),
    ).toEqual([]);
    user.findMany.mockResolvedValue([{ id: 'expert' }]);
    expect(await accounts.managedReadUsers(actor, 'branch')).toEqual([]);
    expect(personnel.callCenterRequestTeam).toHaveBeenCalledTimes(1);
  });
  it('keeps existing legacy and workflow permissions separate', async () => {
    vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'LOCAL_TEST');
    const { access, directory, personnel } = setup();
    const legacy = {
      ...actor,
      permissions: [
        ...actor.permissions,
        'customer_affairs.call_center.contacts.read.team',
      ],
    } as AuthenticatedActor;
    vi.spyOn(access, 'scoped').mockReturnValue(true);
    expect(await access.users(legacy, 'branch', 'contacts')).toEqual([
      'manager',
      'legacy-foreign',
    ]);
    expect(personnel.callCenterRequestTeam).not.toHaveBeenCalled();
    expect(directory.callCenterTeam).toHaveBeenCalled();
    vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
    await expect(access.users(actor, 'branch', 'workflow')).resolves.toEqual([
      'manager',
    ]);
  });
  it('shares the same manager IDs across contact predicates and report SQL, retaining actual call evidence', async () => {
    vi.stubEnv('CALL_CENTER_ACCESS_POLICY', 'ANSWERED');
    const { access } = setup();
    const where = JSON.stringify(await access.where(actor, 'branch'));
    expect(where).toContain('answerResponsibilities');
    expect(where).toContain('OUTBOUND');
    expect(where).toContain('expert');
    expect(where).not.toContain('legacy-foreign');
    const sql = await access.sql(actor, 'branch', 'reports');
    expect(sql.values).toContain('expert');
    expect(sql.sql).toContain('call_center_answer_responsibilities');
  });
});
