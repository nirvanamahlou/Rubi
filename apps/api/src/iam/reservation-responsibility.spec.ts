import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { IamService } from './iam.service';
const actor = {
  userId: 'actor',
  sessionId: 'session',
  branchIds: ['allowed'],
  permissions: ['reservations.read'],
};
function setup() {
  const users = vi
    .fn()
    .mockResolvedValue([{ id: 'responsible', displayName: 'Responsible' }]);
  const latest = vi.fn().mockResolvedValue(null),
    create = vi.fn().mockResolvedValue({});
  const service = Object.create(IamService.prototype) as IamService;
  Object.defineProperty(service, 'database', {
    value: {
      client: {
        user: { findMany: users },
        auditEvent: { findFirst: latest, create },
      },
    },
  });
  return { service, users, latest, create };
}
describe('scoped reservation responsibility IAM boundary', () => {
  it('projects only responsible identity labels without granting access to a user directory', async () => {
    const s = setup();
    expect(
      await s.service.reservationResponsibilityNames(
        ['responsible', 'responsible'],
        'allowed',
        actor as never,
      ),
    ).toEqual(new Map([['responsible', 'Responsible']]));
    expect(s.users).toHaveBeenCalledWith({
      where: { id: { in: ['responsible'] } },
      select: { id: true, displayName: true },
    });
  });
  it('requires reservation visibility and matching branch before querying names or audit', async () => {
    const s = setup();
    await expect(
      s.service.reservationResponsibilityNames(
        ['responsible'],
        'other',
        actor as never,
      ),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      s.service.latestReservationOperation('intake', 'allowed', {
        ...actor,
        permissions: [],
      } as never),
    ).rejects.toThrow(ForbiddenException);
    expect(s.users).not.toHaveBeenCalled();
    expect(s.latest).not.toHaveBeenCalled();
  });
  it('queries only successful activity for the specific authorized intake and branch', async () => {
    const s = setup();
    await s.service.latestReservationOperation(
      'intake',
      'allowed',
      actor as never,
    );
    expect(s.latest).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityType: 'reservation_operation',
          entityId: 'intake',
          outcome: 'SUCCESS',
          metadata: { path: ['branchId'], equals: 'allowed' },
        },
        select: { actorUserId: true, occurredAt: true },
      }),
    );
  });
  it('records metadata without accepting client time or passenger payloads', async () => {
    const s = setup();
    await s.service.recordReservationOperation(
      'intake',
      'allowed',
      actor as never,
      'reservations.rename',
    );
    expect(s.create).toHaveBeenCalledWith({
      data: {
        actorUserId: 'actor',
        action: 'reservations.rename',
        entityType: 'reservation_operation',
        entityId: 'intake',
        outcome: 'SUCCESS',
        metadata: { branchId: 'allowed' },
      },
    });
    await expect(
      s.service.recordReservationOperation(
        'intake',
        'other',
        actor as never,
        'reservations.rename',
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(s.create).toHaveBeenCalledTimes(1);
  });
});
