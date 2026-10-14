import { describe, expect, it, vi } from 'vitest';

import type { DatabaseService } from '../database/database.service';
import { NotificationsRepository } from './notifications.repository';

describe('NotificationsRepository recipient scoping', () => {
  it('lists and counts only notifications belonging to the authenticated user', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const database = {
      client: {
        notification: { findMany, count },
        $transaction: vi.fn(async (operations: Promise<unknown>[]) =>
          Promise.all(operations),
        ),
      },
    } as unknown as DatabaseService;
    const repository = new NotificationsRepository(database);

    await repository.listForRecipient('user-a', 20);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { recipientUserId: 'user-a' } }),
    );
    expect(count).toHaveBeenCalledWith({
      where: { recipientUserId: 'user-a', readAt: null },
    });
  });

  it('cannot mark another recipient notification as read', async () => {
    const updateMany = vi.fn().mockResolvedValue({ count: 0 });
    const count = vi.fn().mockResolvedValue(0);
    const database = {
      client: { notification: { updateMany, count } },
    } as unknown as DatabaseService;
    const repository = new NotificationsRepository(database);

    expect(await repository.markRead('notification-a', 'user-b')).toBe(-1);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'notification-a',
          recipientUserId: 'user-b',
          readAt: null,
        },
      }),
    );
  });

  it('clears only read notifications belonging to the authenticated user', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 });
    const database = {
      client: { notification: { deleteMany } },
    } as unknown as DatabaseService;
    const repository = new NotificationsRepository(database);

    expect(await repository.clearRead('user-a')).toBe(2);
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        recipientUserId: 'user-a',
        readAt: { not: null },
      },
    });
  });
});

it('filters unauthorized destinations before pagination and unread counting', async () => {
  const findMany = vi.fn().mockResolvedValue([
    { id: 'finance', href: '/finance', readAt: null },
    { id: 'private', href: null, readAt: null },
    { id: 'read', href: null, readAt: new Date() },
  ]);
  const repository = new NotificationsRepository({
    client: {
      notification: { findMany, count: vi.fn().mockResolvedValue(99) },
      $transaction: async (items: Promise<unknown>[]) => Promise.all(items),
    },
  } as unknown as DatabaseService);
  const result = await repository.listForRecipient('limited-user', 1, []);
  expect(result.rows.map((row) => row.id)).toEqual(['private']);
  expect(result.unreadCount).toBe(1);
  expect(findMany.mock.calls[0]![0].where).toEqual({
    recipientUserId: 'limited-user',
  });
  expect(findMany.mock.calls[0]![0]).not.toHaveProperty('take');
});
