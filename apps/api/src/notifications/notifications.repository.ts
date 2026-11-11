import { canViewRoute } from '@nora/contracts';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@nora/database';

import { DatabaseService } from '../database/database.service';

const notificationInclude = {
  actor: { select: { id: true, displayName: true } },
} satisfies Prisma.NotificationInclude;

export type NotificationRow = Prisma.NotificationGetPayload<{
  include: typeof notificationInclude;
}>;

@Injectable()
export class NotificationsRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async listForRecipient(
    recipientUserId: string,
    limit: number,
    permissions?: readonly string[],
  ) {
    if (permissions)
      return this.listAuthorized(recipientUserId, limit, permissions);
    const [rows, unreadCount] = await this.database.client.$transaction([
      this.database.client.notification.findMany({
        where: { recipientUserId },
        include: notificationInclude,
        orderBy: [
          { readAt: { sort: 'asc', nulls: 'first' } },
          { occurredAt: 'desc' },
          { id: 'desc' },
        ],
        take: limit,
      }),
      this.database.client.notification.count({
        where: { recipientUserId, readAt: null },
      }),
    ]);
    return { rows, unreadCount };
  }

  private async listAuthorized(
    recipientUserId: string,
    limit: number,
    permissions: readonly string[],
  ) {
    return this.database.client.$transaction(
      (transaction) =>
        this.scanAuthorized(transaction, recipientUserId, limit, permissions),
      { isolationLevel: 'RepeatableRead', timeout: 10000 },
    );
  }

  private async scanAuthorized(
    transaction: Prisma.TransactionClient,
    recipientUserId: string,
    limit: number,
    permissions: readonly string[],
  ) {
    const notifications = transaction.notification;
    const allowed = (row: { href: string | null }) =>
      !row.href || canViewRoute(permissions, row.href);
    const scanRead = async function* () {
      const pageSize = 200;
      const where = { recipientUserId, readAt: { not: null } };
      let cursor: string | undefined;
      for (;;) {
        const page = await notifications.findMany({
          where,
          select: { id: true, href: true },
          orderBy: [{ readAt: 'asc' }, { occurredAt: 'desc' }, { id: 'desc' }],
          take: pageSize,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        yield* page;
        if (page.length < pageSize) return;
        cursor = page[page.length - 1]!.id;
      }
    };

    const destinations = await notifications.groupBy({
      by: ['href'],
      where: { recipientUserId, readAt: null },
      _count: { _all: true },
    });
    const allowedDestinations = destinations.filter(allowed);
    const unreadCount = allowedDestinations.reduce(
      (count, row) => count + row._count._all,
      0,
    );
    const allowedHrefs = allowedDestinations.flatMap(({ href }) =>
      href === null ? [] : [href],
    );
    const includeUnlinked = allowedDestinations.some(
      ({ href }) => href === null,
    );
    const unread = unreadCount
      ? await transaction.$queryRaw<{ id: string }[]>`
          SELECT id
          FROM notifications
          WHERE recipient_user_id = ${recipientUserId}::uuid
            AND read_at IS NULL
            AND ((${includeUnlinked} AND href IS NULL)
                 OR href = ANY(${allowedHrefs}::text[]))
          ORDER BY CASE
            WHEN source_module = 'customer-affairs'
             AND event_type = 'call-center.assigned' THEN 0
            ELSE 1
          END, occurred_at DESC, id DESC
          LIMIT ${limit}
        `
      : [];
    const ids = unread.map(({ id }) => id);
    if (ids.length < limit) {
      for await (const row of scanRead()) {
        if (!allowed(row)) continue;
        ids.push(row.id);
        if (ids.length >= limit) break;
      }
    }
    if (!ids.length) return { rows: [], unreadCount };
    const details = await notifications.findMany({
      where: { recipientUserId, id: { in: ids } },
      include: notificationInclude,
    });
    const byId = new Map(details.filter(allowed).map((row) => [row.id, row]));
    return {
      rows: ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [row] : [];
      }),
      unreadCount,
    };
  }

  async markRead(id: string, recipientUserId: string): Promise<number> {
    const result = await this.database.client.notification.updateMany({
      where: { id, recipientUserId, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count > 0) return result.count;
    const exists = await this.database.client.notification.count({
      where: { id, recipientUserId },
    });
    return exists > 0 ? 0 : -1;
  }

  async markAllRead(recipientUserId: string): Promise<number> {
    const result = await this.database.client.notification.updateMany({
      where: { recipientUserId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  async clearRead(recipientUserId: string): Promise<number> {
    const result = await this.database.client.notification.deleteMany({
      where: { recipientUserId, readAt: { not: null } },
    });
    return result.count;
  }
}
