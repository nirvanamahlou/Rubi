import { describe, expect, it, vi } from 'vitest';

import { AutomationTasksService } from './automation-tasks.service';

describe('AutomationTasksService', () => {
  it('does not access the task projection for a new unassigned draft', async () => {
    const tx = {
      automationTask: {
        updateMany: vi.fn(),
        upsert: vi.fn(),
      },
    };
    const service = new AutomationTasksService({ client: {} } as never);

    await expect(
      service.syncProcurementWithinTransaction(tx as never, {
        eventId: 'a7d3af52-dd3a-4340-8d59-88a44daf36e8',
        requestId: 'request-1',
        requestNumber: 'PR-1405-001',
        branchId: 'branch-a',
        status: 'DRAFT',
        ownerUserId: null,
        approverUserId: null,
        action: 'CREATE',
      }),
    ).resolves.toBeNull();

    expect(tx.automationTask.updateMany).not.toHaveBeenCalled();
    expect(tx.automationTask.upsert).not.toHaveBeenCalled();
  });

  it('completes stale work and assigns the current Procurement approver', async () => {
    const tx = {
      automationTask: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        upsert: vi.fn().mockResolvedValue({ id: 'task-1' }),
      },
    };
    const service = new AutomationTasksService({ client: {} } as never);
    await service.syncProcurementWithinTransaction(tx as never, {
      eventId: 'a7d3af52-dd3a-4340-8d59-88a44daf36e8',
      requestId: 'request-1',
      requestNumber: 'PR-1405-001',
      branchId: 'branch-a',
      status: 'IN_REVIEW',
      ownerUserId: 'owner-1',
      approverUserId: 'approver-1',
      action: 'SUBMIT',
    });

    expect(tx.automationTask.updateMany).toHaveBeenCalled();
    expect(tx.automationTask.upsert).toHaveBeenCalledTimes(2);
    expect(tx.automationTask.upsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        create: expect.objectContaining({
          assigneeUserId: 'owner-1',
          kind: 'PROCUREMENT_FOLLOW_UP',
        }),
      }),
    );
    expect(tx.automationTask.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          assigneeUserId: 'approver-1',
          kind: 'PROCUREMENT_APPROVAL',
        }),
      }),
    );
  });

  it('returns only open follow-up tasks for the actor in their branches', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'task-1',
        sourceReference: 'request-1',
        title: 'پیگیری درخواست خرید PR-1',
        dueAt: new Date('2026-10-07T10:00:00Z'),
        createdAt: new Date('2026-10-06T10:00:00Z'),
      },
    ]);
    const service = new AutomationTasksService({
      client: { automationTask: { findMany } },
    } as never);

    await expect(
      service.assignedProcurementFollowUps({
        userId: 'user-1',
        branchIds: ['branch-1', 'branch-2'],
        permissions: [],
        sessionId: 'session-1',
      }),
    ).resolves.toEqual({
      items: [
        {
          id: 'task-1',
          requestId: 'request-1',
          title: 'پیگیری درخواست خرید PR-1',
          dueAt: '2026-10-07T10:00:00.000Z',
          createdAt: '2026-10-06T10:00:00.000Z',
        },
      ],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sourceModule: 'PROCUREMENT',
          kind: 'PROCUREMENT_FOLLOW_UP',
          status: 'OPEN',
          assigneeUserId: 'user-1',
          branchId: { in: ['branch-1', 'branch-2'] },
        },
        take: 100,
      }),
    );
  });

  it('does not query tasks when the authenticated user has no branches', async () => {
    const findMany = vi.fn();
    const service = new AutomationTasksService({
      client: { automationTask: { findMany } },
    } as never);
    await expect(
      service.assignedProcurementFollowUps({
        userId: 'user-1',
        branchIds: [],
        permissions: [],
        sessionId: 'session-1',
      }),
    ).resolves.toEqual({ items: [] });
    expect(findMany).not.toHaveBeenCalled();
  });
});
