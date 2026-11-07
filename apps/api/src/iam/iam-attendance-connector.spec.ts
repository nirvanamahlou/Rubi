import { afterEach, describe, expect, it, vi } from 'vitest';
import { IamService } from './iam.service';

const userId = '11111111-1111-4111-8111-111111111111';
const currentSession = '22222222-2222-4222-8222-222222222222';
function subject({
  exists = true,
  revalidate = true,
  permissions = ['hr.manage'],
  branches = ['configured', 'other'],
} = {}) {
  vi.stubEnv('HR_RADAN_ENABLED', 'true');
  vi.stubEnv('HR_RADAN_ACTOR_ID', userId);
  vi.stubEnv('HR_RADAN_BRANCH_ID', 'configured');
  vi.stubEnv('HR_RADAN_SECONDARY_BRANCH_ID', 'second');
  vi.stubEnv('CALL_CENTER_HR_ROUTING_ENABLED', 'false');
  const findFirst = vi
    .fn()
    .mockResolvedValueOnce(exists ? { id: currentSession } : null)
    .mockResolvedValueOnce(
      revalidate
        ? {
            id: currentSession,
            userId,
            status: 'ACTIVE',
            user: {
              status: 'ACTIVE',
              branches: branches.map((branchId) => ({ branchId })),
            },
          }
        : null,
    );
  const service = Object.assign(Object.create(IamService.prototype), {
    database: { client: { session: { findFirst } } },
    userAccessInclude: () => ({}),
    permissionCodes: () => permissions,
  }) as IamService;
  return { service, findFirst };
}
afterEach(() => vi.unstubAllEnvs());
describe('trusted attendance connector actor', () => {
  it('uses a current live native session, revalidates access and narrows configured branches', async () => {
    const { service, findFirst } = subject();
    const actor = await service.authenticateAttendanceConnectorV1(userId);
    expect(actor).toMatchObject({
      userId,
      sessionId: currentSession,
      branchIds: ['configured'],
      permissions: ['hr.manage'],
    });
    expect(findFirst.mock.calls[0]![0]).toMatchObject({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: { gt: expect.any(Date) },
        user: { status: 'ACTIVE' },
      },
    });
    expect(findFirst.mock.calls[1]![0]).toMatchObject({
      where: {
        id: currentSession,
        userId,
        status: 'ACTIVE',
        expiresAt: { gt: expect.any(Date) },
      },
    });
  });
  it.each([
    { exists: false },
    { revalidate: false },
    { permissions: ['hr.read'] },
    { branches: ['other'] },
  ])(
    'denies missing/revoked session or withdrawn access (%j)',
    async (options) => {
      const { service } = subject(options);
      await expect(
        service.authenticateAttendanceConnectorV1(userId),
      ).rejects.toThrow();
    },
  );
  it('rejects disabled connector or a different account before querying sessions', async () => {
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
