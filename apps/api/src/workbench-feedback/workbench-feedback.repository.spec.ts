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
  it('deletes only a matching HR survey in its authorized branch', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new WorkbenchFeedbackRepository(
      { client: { workbenchFeedback: { deleteMany } } } as never,
      {} as never,
    );
    await repository.deleteHr(record.id, record.branchId);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        id: record.id,
        branchId: record.branchId,
        department: 'HUMAN_RESOURCES',
      },
    });
  });
  it('queries only HR submissions from authorized branches', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const repository = new WorkbenchFeedbackRepository(
      {
        client: { workbenchFeedback: { findMany, count } },
      } as never,
      {} as never,
    );
    const branches = [record.branchId];
    await repository.listHr(branches, 2, 20);
    await repository.countHr(branches);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { branchId: { in: branches }, department: 'HUMAN_RESOURCES' },
        skip: 20,
        take: 20,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: { branchId: { in: branches }, department: 'HUMAN_RESOURCES' },
    });
  });
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

  it('returns the committed receipt when a concurrent submission wins the unique key', async () => {
    const existing = {
      ...record,
      isAnonymous: true,
      submittedAt: new Date('2026-09-12T10:00:00.000Z'),
    };
    const findUnique = vi.fn().mockResolvedValue(existing);
    const transaction = {
      workbenchFeedback: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue({ code: 'P2002' }),
      },
    };
    const notifications = { createWithinTransaction: vi.fn() };
    const repository = new WorkbenchFeedbackRepository(
      {
        client: {
          $transaction: (callback: (tx: unknown) => unknown) =>
            callback(transaction),
          workbenchFeedback: { findUnique },
        },
      } as never,
      notifications as never,
    );

    const result = await repository.create(record);

    expect(result.trackingNumber).toBe(existing.trackingNumber);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: record.id } });
    expect(notifications.createWithinTransaction).not.toHaveBeenCalled();
  });

  it('rejects a concurrent submission that reuses an id for different content', async () => {
    const transaction = {
      workbenchFeedback: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockRejectedValue({ code: 'P2002' }),
      },
    };
    const repository = new WorkbenchFeedbackRepository(
      {
        client: {
          $transaction: (callback: (tx: unknown) => unknown) =>
            callback(transaction),
          workbenchFeedback: {
            findUnique: vi.fn().mockResolvedValue({
              ...record,
              requestHash: 'b'.repeat(64),
            }),
          },
        },
      } as never,
      { createWithinTransaction: vi.fn() } as never,
    );

    await expect(repository.create(record)).rejects.toMatchObject({
      status: 409,
    });
  });
});
