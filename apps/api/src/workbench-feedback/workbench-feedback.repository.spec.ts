import { describe, expect, it, vi } from 'vitest';

import { WorkbenchFeedbackRepository } from './workbench-feedback.repository';

const record = {
  id: '44444444-4444-4444-8444-444444444444',
  trackingNumber: 'WB-444444444444',
  requestHash: 'a'.repeat(64),
  branchId: '33333333-3333-4333-8333-333333333333',
  department: 'HUMAN_RESOURCES',
  departmentCode: 'hr' as const,
  departmentLabel: 'منابع انسانی',
  subject: 'پیشنهاد کارکنان',
  body: 'متن نظر',
  anonymous: true,
  attachmentCount: 1,
  submittedByUserId: '11111111-1111-4111-8111-111111111111',
  recipientUserIds: ['66666666-6666-4666-8666-666666666666'],
};

describe('WorkbenchFeedbackRepository', () => {
  it('persists once and creates an actor-free notification for anonymous feedback', async () => {
    const submittedAt = new Date('2026-09-12T10:00:00.000Z');
    const transaction = {
      workbenchFeedback: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          ...record,
          isAnonymous: true,
          submittedAt,
        }),
      },
    };
    const database = {
      client: {
        $transaction: (callback: (tx: unknown) => unknown) =>
          callback(transaction),
      },
    };
    const notifications = { createWithinTransaction: vi.fn() };
    const repository = new WorkbenchFeedbackRepository(
      database as never,
      notifications as never,
    );

    const result = await repository.create(record);

    expect(transaction.workbenchFeedback.create).toHaveBeenCalledOnce();
    expect(notifications.createWithinTransaction).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        actorUserId: null,
        recipientUserIds: record.recipientUserIds,
        entityId: record.id,
      }),
    );
    expect(result.trackingNumber).toBe(record.trackingNumber);
  });

  it('returns an idempotent receipt without creating a second notification', async () => {
    const existing = {
      ...record,
      isAnonymous: true,
      submittedAt: new Date('2026-09-12T10:00:00.000Z'),
    };
    const transaction = {
      workbenchFeedback: {
        findUnique: vi.fn().mockResolvedValue(existing),
        create: vi.fn(),
      },
    };
    const database = {
      client: {
        $transaction: (callback: (tx: unknown) => unknown) =>
          callback(transaction),
      },
    };
    const notifications = { createWithinTransaction: vi.fn() };
    const repository = new WorkbenchFeedbackRepository(
      database as never,
      notifications as never,
    );

    await repository.create(record);

    expect(transaction.workbenchFeedback.create).not.toHaveBeenCalled();
    expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
  });
});
