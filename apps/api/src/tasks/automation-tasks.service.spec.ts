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
    const service = new AutomationTasksService();

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
    const service = new AutomationTasksService();
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
    expect(tx.automationTask.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          assigneeUserId: 'approver-1',
          kind: 'PROCUREMENT_APPROVAL',
        }),
      }),
    );
  });
});
