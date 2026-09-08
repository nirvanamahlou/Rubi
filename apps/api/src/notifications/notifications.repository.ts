import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@rubi/database';

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

  async listForRecipient(recipientUserId: string, limit: number) {
    const [rows, unreadCount] = await this.database.client.$transaction([
      this.database.client.notification.findMany({
        where: { recipientUserId },
        include: notificationInclude,
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: limit,
      }),
      this.database.client.notification.count({
        where: { recipientUserId, readAt: null },
      }),
    ]);
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
