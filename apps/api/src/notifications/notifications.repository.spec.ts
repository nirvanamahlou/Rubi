import { describe, expect, it, vi } from 'vitest';
import { MANUAL_ACCESS_VERSION } from '@nora/contracts';

import type { DatabaseService } from '../database/database.service';
import { NotificationsRepository } from './notifications.repository';

function mockFindMany(
  rows: { id: string; href: string | null; readAt: Date | null }[],
) {
  return vi.fn(
    async (query: {
      where: { id?: { in: string[] }; readAt?: null | { not: null } };
      cursor?: { id: string };
      take?: number;
    }) => {
      const ids = query.where.id?.in;
      if (ids) return rows.filter((row) => ids.includes(row.id));
      const matching = rows.filter(
        (row) => (row.readAt === null) === (query.where.readAt === null),
      );
      const start = query.cursor
        ? matching.findIndex((row) => row.id === query.cursor?.id) + 1
        : 0;
      return matching.slice(start, start + (query.take ?? matching.length));
    },
  );
}

function mockAuthorizedFeed(
  rows: {
    id: string;
    href: string | null;
    readAt: Date | null;
    sourceModule?: string;
    eventType?: string;
  }[],
) {
  const findMany = mockFindMany(rows);
  const groupBy = vi.fn(async () => {
    const counts = new Map<string | null, number>();
    for (const row of rows) {
      if (row.readAt === null) {
        counts.set(row.href, (counts.get(row.href) ?? 0) + 1);
      }
    }
    return [...counts].map(([href, count]) => ({
      href,
      _count: { _all: count },
    }));
  });
  const queryRaw = vi.fn(
    async (
      _query: TemplateStringsArray,
      _recipientId: string,
      includeUnlinked: boolean,
      hrefs: string[],
      limit: number,
    ) => {
      const candidates = rows.filter(
        (row) =>
          row.readAt === null &&
          (row.href === null ? includeUnlinked : hrefs.includes(row.href)),
      );
      const urgent = (row: (typeof rows)[number]) =>
        row.sourceModule === 'customer-affairs' &&
        row.eventType === 'call-center.assigned';
      return [
        ...candidates.filter(urgent),
        ...candidates.filter((row) => !urgent(row)),
      ]
        .slice(0, limit)
        .map(({ id }) => ({ id }));
    },
  );
  const repository = new NotificationsRepository({
    client: {
      $transaction: async (read: (client: unknown) => unknown) =>
        read({ notification: { findMany, groupBy }, $queryRaw: queryRaw }),
    },
  } as unknown as DatabaseService);
  return { repository, findMany, groupBy, queryRaw };
}

describe('NotificationsRepository recipient scoping', () => {
  it('keeps an older unread Call Center assignment visible beyond the feed limit, then stops prioritizing it after reading', async () => {
    const assignment = {
      id: 'assignment',
      href: '/customer-affairs/call-center#cc-follow-up-queue',
      readAt: null as Date | null,
      sourceModule: 'customer-affairs',
      eventType: 'call-center.assigned',
    };
    const ordinary = Array.from({ length: 225 }, (_, id) => ({
      id: String(id),
      href: null,
      readAt: null,
    }));
    const { repository } = mockAuthorizedFeed([...ordinary, assignment]);
    const permissions = [
      MANUAL_ACCESS_VERSION,
      'ui.screen.customer-affairs.call-center',
    ];
    const unread = await repository.listForRecipient('expert', 20, permissions);
    expect(unread.rows[0]?.id).toBe('assignment');
    expect(unread.unreadCount).toBe(226);
    assignment.readAt = new Date();
    expect(
      (await repository.listForRecipient('expert', 20, permissions)).rows.some(
        (row) => row.id === 'assignment',
      ),
    ).toBe(false);
    expect(
      (await repository.listForRecipient('expert', 20, [])).rows.some(
        (row) => row.id === 'assignment',
      ),
    ).toBe(false);
  });
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
      expect.objectContaining({
        where: { recipientUserId: 'user-a' },
        orderBy: [
          { readAt: { sort: 'asc', nulls: 'first' } },
          { occurredAt: 'desc' },
          { id: 'desc' },
        ],
        take: 20,
      }),
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
  const { repository, findMany, groupBy, queryRaw } = mockAuthorizedFeed([
    { id: 'finance', href: '/finance', readAt: null },
    { id: 'private', href: null, readAt: null },
    { id: 'empty-link', href: '', readAt: null },
    { id: 'read', href: null, readAt: new Date() },
  ]);
  const result = await repository.listForRecipient('limited-user', 1, []);
  expect(result.rows.map((row) => row.id)).toEqual(['private']);
  expect(result.unreadCount).toBe(2);
  expect(groupBy).toHaveBeenCalledWith({
    by: ['href'],
    where: { recipientUserId: 'limited-user', readAt: null },
    _count: { _all: true },
  });
  expect(queryRaw).toHaveBeenCalledWith(
    expect.any(Array),
    'limited-user',
    true,
    [''],
    1,
  );
  expect(findMany).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      where: { recipientUserId: 'limited-user', id: { in: ['private'] } },
    }),
  );
});
