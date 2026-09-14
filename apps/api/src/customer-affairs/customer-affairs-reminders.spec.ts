import { describe, expect, it, vi, afterEach } from 'vitest';
import { CustomerAffairsRemindersService } from './customer-affairs-reminders.service';

const now = new Date('2026-09-12T12:00:00Z');
function setup(overrides: Record<string, unknown> = {}, replay = false) {
  const row = {
    id: 'ticket',
    branchId: 'branch',
    createdByUserId: 'creator',
    customerOwnerUserId: 'owner',
    executionOwnerUserId: 'executor',
    trackingNumber: 'CA-1',
    version: 1,
    status: 'NEW',
    nextActionAt: new Date('2026-09-12T11:00:00Z'),
    firstResponseDueAt: new Date('2026-09-12T11:30:00Z'),
    resolutionDueAt: new Date('2026-09-13T00:00:00Z'),
    firstRespondedAt: null,
    resolvedAt: null,
    pausedAt: null,
    ...overrides,
  };
  const tx = {
    $queryRaw: vi.fn(),
    customerAffairsLead: {
      findUnique: vi.fn().mockResolvedValue({
        ...row,
        stage: 'NEW',
        assigneeUserId: 'owner',
        ...overrides,
      }),
    },
    customerAffairsTicket: {
      findUnique: vi.fn().mockResolvedValue(row),
      update: vi.fn(),
    },
    customerAffairsCommand: {
      createMany: vi.fn().mockResolvedValue({ count: replay ? 0 : 1 }),
    },
    customerAffairsAuditEvent: { create: vi.fn() },
  };
  const repository = {
    transaction: vi.fn((fn) => fn(tx)),
    dueReminderIds: vi.fn().mockResolvedValue([]),
  };
  const notifications = { createWithinTransaction: vi.fn() };
  const config = { get: vi.fn().mockReturnValue('true') };
  const service = new CustomerAffairsRemindersService(
    repository as never,
    notifications as never,
    config as never,
  );
  return { service, tx, repository, notifications, config };
}
afterEach(() => {
  vi.useRealTimers();
});
describe('Customer Affairs scheduled followups', () => {
  it('claims delivery and writes notifications/audit in the same transaction', async () => {
    const { service, tx, notifications } = setup();
    await service.deliver('ticket', 'ticket', now);
    expect(notifications.createWithinTransaction).toHaveBeenCalledTimes(2);
    expect(notifications.createWithinTransaction.mock.calls[0]?.[0]).toBe(tx);
    expect(tx.customerAffairsCommand.createMany).toHaveBeenCalledTimes(2);
    expect(tx.customerAffairsAuditEvent.create).toHaveBeenCalledTimes(2);
    expect(tx.customerAffairsTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { firstResponseBreachedAt: new Date('2026-09-12T11:30:00Z') },
      }),
    );
  });
  it('does not send duplicate notifications after restart or concurrent claim', async () => {
    const { service, notifications, tx } = setup({}, true);
    await service.deliver('ticket', 'ticket', now);
    expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
    expect(tx.customerAffairsAuditEvent.create).not.toHaveBeenCalled();
  });
  it('rechecks terminal status under lock', async () => {
    for (const status of ['CLOSED', 'CANCELLED', 'RESOLVED']) {
      const { service, tx } = setup({ status });
      await service.deliver('ticket', 'ticket', now);
      expect(tx.$queryRaw).toHaveBeenCalledOnce();
      expect(tx.customerAffairsCommand.createMany).not.toHaveBeenCalled();
    }
  });
  it('suspends SLA alerts when paused but retains the next action reminder', async () => {
    const { service, notifications } = setup({
      pausedAt: now,
      firstRespondedAt: now,
      resolutionDueAt: new Date('2026-09-12T10:00:00Z'),
    });
    await service.deliver('ticket', 'ticket', now);
    expect(notifications.createWithinTransaction).toHaveBeenCalledOnce();
    expect(
      notifications.createWithinTransaction.mock.calls[0]?.[1].eventType,
    ).toBe('followup.due');
  });
  it('routes queue leads to their creator without inventing an assignee', async () => {
    const { service, notifications } = setup({ assigneeUserId: null });
    await service.deliver('lead', 'lead', now);
    expect(
      notifications.createWithinTransaction.mock.calls[0]?.[1].recipientUserIds,
    ).toEqual(['creator']);
  });
  it('propagates delivery failure to roll back the command claim', async () => {
    const { service, notifications } = setup();
    notifications.createWithinTransaction.mockRejectedValueOnce(
      new Error('delivery failed'),
    );
    await expect(service.deliver('ticket', 'ticket', now)).rejects.toThrow(
      'delivery failed',
    );
  });
  it('can be disabled and clears its timer on shutdown', async () => {
    vi.useFakeTimers();
    const { service, repository, config } = setup();
    config.get.mockReturnValue('false');
    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(repository.dueReminderIds).not.toHaveBeenCalled();
    config.get.mockReturnValue('true');
    service.onModuleInit();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(repository.dueReminderIds).toHaveBeenCalledTimes(2);
    service.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(repository.dueReminderIds).toHaveBeenCalledTimes(2);
  });
});
