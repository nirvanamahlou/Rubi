import { describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { FinanceFollowupService } from './finance-followup.service';
const id = '00000000-0000-4000-8000-000000000001';
const actor = {
  userId: id,
  branchIds: [id],
  permissions: ['finance.read', 'finance.account.manage'],
} as unknown as AuthenticatedActor;
function setup(dueAt = '2026-10-05T10:00:00Z') {
  const policy = { branchId: id, managerId: id, version: 1 };
  const claimed = new Set<string>();
  const client = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    financeReminderPolicy: {
      findMany: vi.fn().mockResolvedValue([policy]),
      findUnique: vi.fn().mockResolvedValue(policy),
    },
    financeOperationalRequest: {
      findUnique: vi.fn().mockResolvedValue({ status: 'NEW' }),
    },
    financeReminderDelivery: {
      createMany: vi.fn().mockImplementation(({ data }) => {
        const key = data.sourceKey + ':' + data.phase;
        if (claimed.has(key)) return { count: 0 };
        claimed.add(key);
        return { count: 1 };
      }),
    },
    financeSavedView: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn(),
  };
  client.$transaction.mockImplementation((fn) => fn(client));
  const identity = {
    reminderPrincipal: vi.fn().mockResolvedValue(actor),
    eligible: vi.fn().mockResolvedValue(true),
  };
  const notifications = {
    createWithinTransaction: vi.fn().mockResolvedValue(undefined),
  };
  const inbox = {
    list: vi
      .fn()
      .mockResolvedValue({
        items: [
          {
            id: 'operational:' + id,
            sourceReference: id,
            kind: 'OPERATIONAL_REQUEST',
            branchReference: id,
            status: 'NEW',
            dueAt,
          },
        ],
      }),
  };
  return {
    service: new FinanceFollowupService(
      { client } as never,
      identity as never,
      notifications as never,
      inbox as never,
    ),
    client,
    identity,
    notifications,
    inbox,
  };
}
describe('Finance branch deadline follow-up', () => {
  it('sends once at one day before and once at one day after, not in between', async () => {
    const f = setup();
    await f.service.deliverDue(new Date('2026-10-04T09:59:59Z'));
    expect(f.notifications.createWithinTransaction).not.toHaveBeenCalled();
    await f.service.deliverDue(new Date('2026-10-04T10:00:00Z'));
    await f.service.deliverDue(new Date('2026-10-04T11:00:00Z'));
    expect(f.notifications.createWithinTransaction).toHaveBeenCalledTimes(1);
    await f.service.deliverDue(new Date('2026-10-06T09:59:59Z'));
    expect(f.notifications.createWithinTransaction).toHaveBeenCalledTimes(1);
    await f.service.deliverDue(new Date('2026-10-06T10:00:00Z'));
    expect(f.notifications.createWithinTransaction).toHaveBeenCalledTimes(2);
    expect(
      f.notifications.createWithinTransaction.mock.calls[1]?.[1],
    ).toMatchObject({
      recipientUserIds: [id],
      eventType: 'finance.request.overdue',
    });
  });
  it('skips a manager whose access has been revoked', async () => {
    const f = setup();
    f.identity.reminderPrincipal.mockResolvedValue(null);
    await f.service.deliverDue(new Date('2026-10-04T10:00:00Z'));
    expect(f.inbox.list).not.toHaveBeenCalled();
    expect(f.notifications.createWithinTransaction).not.toHaveBeenCalled();
  });
  it('skips settled cases and a concurrently reassigned policy', async () => {
    const f = setup();
    f.client.financeOperationalRequest.findUnique.mockResolvedValue({
      status: 'PAID',
    });
    await f.service.deliverDue(new Date('2026-10-04T10:00:00Z'));
    f.client.financeReminderPolicy.findUnique.mockResolvedValue({
      branchId: id,
      managerId: id,
      version: 2,
    });
    await f.service.deliverDue(new Date('2026-10-04T10:00:00Z'));
    expect(f.notifications.createWithinTransaction).not.toHaveBeenCalled();
  });
  it('covers legacy inbox deadlines without fabricating an operational case FK', async () => {
    const f = setup();
    f.inbox.list.mockResolvedValue({
      items: [
        {
          id: 'sales:' + id,
          sourceReference: id,
          kind: 'PAYMENT_REQUEST',
          branchReference: id,
          status: 'NEW',
          dueAt: '2026-10-05T10:00:00Z',
        },
      ],
    });
    await f.service.deliverDue(new Date('2026-10-04T10:00:00Z'));
    expect(f.client.financeReminderDelivery.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ requestId: null }),
      }),
    );
  });
  it('lists and removes only the authenticated user’s personal views', async () => {
    const f = setup();
    await f.service.views(actor);
    await f.service.removeView(id, actor);
    expect(f.client.financeSavedView.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: id } }),
    );
    expect(f.client.financeSavedView.deleteMany).toHaveBeenCalledWith({
      where: { id, ownerId: id },
    });
  });
  it('requires finance administration and rejects manager selection outside the branch', async () => {
    const f = setup();
    await expect(
      f.service.setPolicy(
        { branchId: id, managerId: id, expectedVersion: 0 },
        { ...actor, permissions: ['finance.read'] },
      ),
    ).rejects.toThrow();
    await expect(
      f.service.setPolicy(
        { branchId: id, managerId: id, expectedVersion: 0 },
        { ...actor, branchIds: [] },
      ),
    ).rejects.toThrow();
    expect(f.client.$transaction).not.toHaveBeenCalled();
  });
});
