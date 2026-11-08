import { describe, expect, it, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { validateWorkbenchLeave } from './workbench-hr-request.domain';
import { CustomerAffairsService } from './customer-affairs.service';
const leave = {
  from: '2026-11-05',
  to: '2026-11-05',
  mode: 'روزانه' as const,
  reason: 'دلیل آزمایشی',
};
const actor = {
  userId: 'reviewer',
  branchIds: ['branch'],
  permissions: ['hr.manage', 'hr.approve'],
} as unknown as AuthenticatedActor;
function setup(status = 'NEW') {
  const row = {
    id: 'request',
    version: 1,
    status,
    branchId: 'branch',
    createdByUserId: 'sender',
    executionUnit: 'منابع انسانی',
    executionOwnerUserId: 'reviewer',
    subject: 'مرخصی',
    timeline: [{ type: 'WORKBENCH_LEAVE', summary: JSON.stringify(leave) }],
  };
  const tx = {
    $queryRaw: vi.fn(),
    customerAffairsTicket: {
      findFirst: vi.fn().mockResolvedValue(row),
      update: vi.fn(),
    },
    customerAffairsTimeline: { create: vi.fn() },
    customerAffairsAuditEvent: { create: vi.fn() },
  };
  const repository = { transaction: vi.fn(async (fn) => fn(tx)) };
  const hr = {
    approveWorkbenchLeave: vi.fn(),
    reconcileWorkbenchLeave: vi.fn(),
  };
  const notifications = { createWithinTransaction: vi.fn() };
  const directory = {
    workbenchFeedbackRecipientUserIds: vi
      .fn()
      .mockResolvedValue(['hr-reviewer']),
  };
  const service = new CustomerAffairsService(
    repository as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    notifications as never,
    directory as never,
    undefined,
    undefined,
    hr as never,
  );
  return { service, tx, row, hr, notifications, directory };
}
describe('HR Workbench review', () => {
  it('does not let HR approve before the selected substitute consents', async () => {
    const { service, row, hr } = setup();
    row.timeline[0]!.summary = JSON.stringify({
      ...leave,
      substituteUserId: 'substitute',
    });
    for (const outcome of ['PENDING', 'REJECTED']) {
      row.timeline[1] = {
        type: 'WORKBENCH_SUBSTITUTE',
        summary: 'substitute',
        outcome,
      } as never;
      await expect(
        service.reviewHrWorkbenchRequest(
          'request',
          { version: 1, status: 'APPROVED' },
          actor,
        ),
      ).rejects.toThrow('جانشین');
    }
    expect(hr.approveWorkbenchLeave).not.toHaveBeenCalled();
    row.timeline[1] = {
      type: 'WORKBENCH_SUBSTITUTE',
      summary: 'substitute',
      outcome: 'APPROVED',
    } as never;
    await service.reviewHrWorkbenchRequest(
      'request',
      { version: 1, status: 'APPROVED' },
      actor,
    );
    expect(hr.approveWorkbenchLeave).toHaveBeenCalledOnce();
  });
  it('approves through the HR public port in the same transaction and refreshes attendance', async () => {
    const { service, tx, hr, notifications } = setup();
    await service.reviewHrWorkbenchRequest(
      'request',
      { version: 1, status: 'APPROVED' },
      actor,
    );
    expect(hr.approveWorkbenchLeave).toHaveBeenCalledWith(
      tx,
      'request',
      'branch',
      'sender',
      leave,
      actor,
    );
    expect(tx.customerAffairsTicket.update).toHaveBeenCalledWith({
      where: { id: 'request' },
      data: expect.objectContaining({
        status: 'RESOLVED',
        version: { increment: 1 },
      }),
    });
    expect(hr.reconcileWorkbenchLeave).toHaveBeenCalledWith(
      'branch',
      leave,
      actor,
      'sender',
    );
    expect(notifications.createWithinTransaction).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ recipientUserIds: ['sender'] }),
    );
  });
  it.each(['REJECTED', 'NEEDS_REVISION'])(
    'does not create leave for %s',
    async (status) => {
      const { service, hr } = setup();
      await service.reviewHrWorkbenchRequest(
        'request',
        { version: 1, status },
        actor,
      );
      expect(hr.approveWorkbenchLeave).not.toHaveBeenCalled();
      expect(hr.reconcileWorkbenchLeave).not.toHaveBeenCalled();
    },
  );
  it('does not approve or notify when the native leave rules fail', async () => {
    const { service, tx, hr, notifications } = setup();
    hr.approveWorkbenchLeave.mockRejectedValue(
      new ConflictException('balance'),
    );
    await expect(
      service.reviewHrWorkbenchRequest(
        'request',
        { version: 1, status: 'APPROVED' },
        actor,
      ),
    ).rejects.toThrow('balance');
    expect(tx.customerAffairsTicket.update).not.toHaveBeenCalled();
    expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
  });
  it('does not consume twice on replay and retries attendance reconciliation', async () => {
    const { service, hr, tx } = setup('APPROVED');
    await service.reviewHrWorkbenchRequest(
      'request',
      { version: 1, status: 'APPROVED' },
      actor,
    );
    expect(hr.approveWorkbenchLeave).not.toHaveBeenCalled();
    expect(tx.customerAffairsTicket.update).not.toHaveBeenCalled();
    expect(hr.reconcileWorkbenchLeave).toHaveBeenCalled();
  });
  it('rejects stale review, self approval and missing privileges', async () => {
    const { service, row } = setup();
    await expect(
      service.reviewHrWorkbenchRequest(
        'request',
        { version: 2, status: 'APPROVED' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.reviewHrWorkbenchRequest(
        'request',
        { version: 1, status: 'APPROVED' },
        { ...actor, permissions: [] },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    row.createdByUserId = actor.userId;
    await expect(
      service.reviewHrWorkbenchRequest(
        'request',
        { version: 1, status: 'APPROVED' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('filters the lookup by authorized branch and Workbench category', async () => {
    const { service, tx } = setup();
    tx.customerAffairsTicket.findFirst.mockResolvedValue(null);
    await expect(
      service.reviewHrWorkbenchRequest(
        'request',
        { version: 1, status: 'APPROVED' },
        actor,
      ),
    ).rejects.toThrow();
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
});
describe('structured leave validation', () => {
  it('accepts valid full-day and hourly leave', () => {
    expect(() => validateWorkbenchLeave(leave)).not.toThrow();
    expect(() =>
      validateWorkbenchLeave({
        ...leave,
        mode: 'ساعتی',
        startTime: '09:15',
        endTime: '11:15',
      }),
    ).not.toThrow();
  });
  it.each([
    { to: '2026-11-04' },
    { from: '2026-02-30' },
    { to: '2027-11-05' },
    { reason: '' },
    { mode: 'ساعتی' as const, startTime: '11:15', endTime: '09:15' },
  ])('rejects invalid data %j', (patch) => {
    expect(() => validateWorkbenchLeave({ ...leave, ...patch })).toThrow(
      BadRequestException,
    );
  });
});

describe('recipient approval before HR', () => {
  it('routes an approved leave to HR without consuming leave or attendance', async () => {
    const f = setup();
    f.row.executionUnit = 'فروش';
    await f.service.reviewHrWorkbenchRequest(
      'request',
      { version: 1, status: 'APPROVED' },
      { ...actor, permissions: [] },
    );
    expect(f.tx.customerAffairsTicket.update).toHaveBeenCalledWith({
      where: { id: 'request' },
      data: expect.objectContaining({
        executionUnit: 'منابع انسانی',
        executionOwnerUserId: 'hr-reviewer',
        version: { increment: 1 },
      }),
    });
    expect(f.hr.approveWorkbenchLeave).not.toHaveBeenCalled();
    expect(f.hr.reconcileWorkbenchLeave).not.toHaveBeenCalled();
    expect(f.notifications.createWithinTransaction).toHaveBeenCalledWith(
      f.tx,
      expect.objectContaining({ recipientUserIds: ['hr-reviewer'] }),
    );
  });
  it('rejects nonrecipients, stale versions, self approval and missing HR routes before writing', async () => {
    const f = setup();
    f.row.executionUnit = 'فروش';
    for (const [reviewer, version] of [
      [{ ...actor, userId: 'other' }, 1],
      [actor, 2],
      [{ ...actor, userId: 'sender' }, 1],
    ] as const)
      await expect(
        f.service.reviewHrWorkbenchRequest(
          'request',
          { version, status: 'APPROVED' },
          reviewer,
        ),
      ).rejects.toThrow();
    f.directory.workbenchFeedbackRecipientUserIds.mockResolvedValue([]);
    await expect(
      f.service.reviewHrWorkbenchRequest(
        'request',
        { version: 1, status: 'APPROVED' },
        actor,
      ),
    ).rejects.toThrow();
    expect(f.tx.customerAffairsTicket.update).not.toHaveBeenCalled();
  });
});
