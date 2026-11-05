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
    const [rows, unreadCount] = await this.database.client.$transaction([
      this.database.client.notification.findMany({
        where: { recipientUserId },
        include: notificationInclude,
        orderBy: [
          { readAt: { sort: 'asc', nulls: 'first' } },
          { occurredAt: 'desc' },
          { id: 'desc' },
        ],
        ...(permissions ? {} : { take: limit }),
      }),
      this.database.client.notification.count({
        where: { recipientUserId, readAt: null },
      }),
    ]);
    if (permissions) {
      const allowed = rows.filter(
        (row) => !row.href || canViewRoute(permissions, row.href),
      );
      // Keep actionable assignments visible even beyond the bounded bell feed.
      allowed.sort((left, right) => {
        const urgent = (row: NotificationRow) =>
          row.readAt === null &&
          row.sourceModule === 'customer-affairs' &&
          row.eventType === 'call-center.assigned';
        return Number(urgent(right)) - Number(urgent(left));
      });
      return {
        rows: allowed.slice(0, limit),
        unreadCount: allowed.filter((row) => row.readAt === null).length,
      };
    }
    return { rows, unreadCount };
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
