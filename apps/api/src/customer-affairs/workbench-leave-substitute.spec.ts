import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { CustomerAffairsService } from './customer-affairs.service';
const actor = {
  userId: 'substitute',
  branchIds: ['branch'],
  permissions: [],
} as unknown as AuthenticatedActor;
function setup() {
  const invite = {
    id: 'event',
    type: 'WORKBENCH_SUBSTITUTE',
    summary: 'substitute',
    outcome: 'PENDING',
  };
  const row = {
    id: 'request',
    version: 1,
    createdByUserId: 'owner',
    executionOwnerUserId: 'hr',
    subject: 'Leave',
    status: 'NEW',
    timeline: [invite],
  };
  const tx = {
    $queryRaw: vi.fn(),
    customerAffairsTicket: {
      findFirst: vi.fn().mockResolvedValue(row),
      update: vi.fn(),
    },
    customerAffairsTimeline: { update: vi.fn(), create: vi.fn() },
  };
  const notifications = { createWithinTransaction: vi.fn() };
  const service = new CustomerAffairsService(
    { transaction: async (fn: (t: typeof tx) => unknown) => fn(tx) } as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    notifications as never,
    {} as never,
  );
  return { service, tx, row, invite, notifications };
}
describe('substitute consent', () => {
  it.each(['APPROVED', 'REJECTED'])(
    'records %s from only the invited user and notifies owner and HR',
    async (status) => {
      const { service, tx, notifications } = setup();
      await service.reviewLeaveSubstitute(
        'request',
        { version: 1, status },
        actor,
      );
      expect(tx.customerAffairsTimeline.update).toHaveBeenCalledWith({
        where: { id: 'event' },
        data: { outcome: status },
      });
      expect(tx.customerAffairsTicket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { version: { increment: 1 }, updatedByUserId: actor.userId },
        }),
      );
      expect(notifications.createWithinTransaction).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ recipientUserIds: ['owner', 'hr'] }),
      );
    },
  );
  it('rejects another user, missing branch match, stale version, and terminal request', async () => {
    const { service, tx, row } = setup();
    await expect(
      service.reviewLeaveSubstitute(
        'request',
        { version: 1, status: 'APPROVED' },
        { ...actor, userId: 'stranger' },
      ),
    ).rejects.toThrow();
    await expect(
      service.reviewLeaveSubstitute(
        'request',
        { version: 2, status: 'APPROVED' },
        actor,
      ),
    ).rejects.toThrow();
    row.status = 'REJECTED';
    await expect(
      service.reviewLeaveSubstitute(
        'request',
        { version: 1, status: 'APPROVED' },
        actor,
      ),
    ).rejects.toThrow();
    tx.customerAffairsTicket.findFirst.mockResolvedValue(null);
    await expect(
      service.reviewLeaveSubstitute(
        'request',
        { version: 1, status: 'APPROVED' },
        actor,
      ),
    ).rejects.toThrow();
    expect(tx.customerAffairsTimeline.update).not.toHaveBeenCalled();
    expect(tx.customerAffairsTicket.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'request',
          branchId: { in: ['branch'] },
          category: { startsWith: 'WORKBENCH_' },
        },
      }),
    );
  });
  it('replays the same decision without changing version or notifying twice', async () => {
    const { service, tx, invite, notifications } = setup();
    invite.outcome = 'APPROVED';
    await service.reviewLeaveSubstitute(
      'request',
      { version: 1, status: 'APPROVED' },
      actor,
    );
    expect(tx.customerAffairsTicket.update).not.toHaveBeenCalled();
    expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
    await expect(
      service.reviewLeaveSubstitute(
        'request',
        { version: 1, status: 'REJECTED' },
        actor,
      ),
    ).rejects.toThrow();
  });
});
