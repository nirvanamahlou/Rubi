import { afterEach, describe, expect, it, vi } from 'vitest';
import { IamService } from './iam.service';

const userId = '11111111-1111-4111-8111-111111111111';
const currentSession = '22222222-2222-4222-8222-222222222222';
function subject({
  exists = true,
  activeBranch = true,
  permissions = ['hr.manage'],
  branches = ['configured', 'other'],
} = {}) {
  vi.stubEnv('HR_RADAN_ENABLED', 'true');
  vi.stubEnv('HR_RADAN_ACTOR_ID', userId);
  vi.stubEnv('HR_RADAN_BRANCH_ID', 'configured');
  vi.stubEnv('HR_RADAN_SECONDARY_BRANCH_ID', 'second');
  vi.stubEnv('CALL_CENTER_HR_ROUTING_ENABLED', 'false');
  const findFirst = vi.fn().mockResolvedValue(
    exists
      ? {
          id: userId,
          status: 'ACTIVE',
          branches: branches.map((branchId) => ({
            branchId,
            branch: { isActive: activeBranch },
          })),
        }
      : null,
  );
  const sessionLookup = vi.fn(() => {
    throw new Error('Browser sessions must not be consulted');
  });
  const service = Object.assign(Object.create(IamService.prototype), {
    database: {
      client: { user: { findFirst }, session: { findFirst: sessionLookup } },
    },
    userAccessInclude: () => ({}),
    permissionCodes: () => permissions,
  }) as IamService;
  return { service, findFirst, sessionLookup };
}
afterEach(() => vi.unstubAllEnvs());
describe('trusted attendance connector actor', () => {
  it('runs without any browser session and grants only configured HR scope', async () => {
    const { service, findFirst, sessionLookup } = subject({
      permissions: ['hr.manage', 'finance.read'],
    });
    const actor = await service.authenticateAttendanceConnectorV1(userId);
    expect(actor).toEqual({
      userId,
      sessionId: `service:attendance:${userId}`,
      branchIds: ['configured'],
      permissions: ['hr.manage'],
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: userId, status: 'ACTIVE' },
      }),
    );
    expect(sessionLookup).not.toHaveBeenCalled();
    findFirst.mockResolvedValueOnce(null);
    await expect(
      service.authenticateAttendanceConnectorV1(userId),
    ).rejects.toThrow();
  });
  it.each([
    { exists: false },
    { activeBranch: false },
    { permissions: ['hr.read'] },
    { branches: ['other'] },
  ])(
    'denies inactive account/branch or withdrawn access (%j)',
    async (options) => {
      const { service } = subject(options);
      await expect(
        service.authenticateAttendanceConnectorV1(userId),
      ).rejects.toThrow();
    },
  );
  it('rejects disabled connector or a different account before querying identity', async () => {
    const { service, findFirst } = subject();
    await expect(
      service.authenticateAttendanceConnectorV1(currentSession),
    ).rejects.toThrow();
    vi.stubEnv('HR_RADAN_ENABLED', 'false');
    await expect(
      service.authenticateAttendanceConnectorV1(userId),
    ).rejects.toThrow();
    expect(findFirst).not.toHaveBeenCalled();
  });
});
