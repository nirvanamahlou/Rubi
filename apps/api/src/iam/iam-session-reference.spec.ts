import { describe, expect, it, vi } from 'vitest';
import { IamService } from './iam.service';

const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';
function subject(status = 'ROTATED', activeFamily = true) {
  const findFirst = vi
    .fn()
    .mockResolvedValueOnce({
      id: sessionId,
      userId,
      familyId: 'family',
      status,
      user: { status: 'ACTIVE', branches: [{ branchId: 'branch' }] },
    })
    .mockResolvedValueOnce(activeFamily ? { id: 'current' } : null);
  const service = Object.create(IamService.prototype) as IamService;
  Object.assign(service, {
    database: { client: { session: { findFirst } } },
    userAccessInclude: () => ({}),
    permissionCodes: () => ['current-grant'],
  });
  return { service, findFirst };
}
describe('trusted IAM session reference', () => {
  it('keeps the bound reference through normal refresh while checking the active family', async () => {
    const { service, findFirst } = subject();
    const actor = await service.authenticateSessionReferenceV1(
      userId,
      sessionId,
      true,
    );
    expect(actor.sessionId).toBe(sessionId);
    expect(actor.permissions).toEqual(['current-grant']);
    expect(findFirst.mock.calls[1]![0].where).toMatchObject({
      familyId: 'family',
      userId,
      status: 'ACTIVE',
    });
  });
  it('denies a rotated reference after family logout', async () => {
    await expect(
      subject('ROTATED', false).service.authenticateSessionReferenceV1(
        userId,
        sessionId,
        true,
      ),
    ).rejects.toThrow();
  });
  it('ordinary access-token authentication only queries ACTIVE sessions', async () => {
    const { service, findFirst } = subject('ACTIVE');
    await service.authenticateSessionReferenceV1(userId, sessionId);
    expect(findFirst.mock.calls[0]![0].where.status).toBe('ACTIVE');
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
