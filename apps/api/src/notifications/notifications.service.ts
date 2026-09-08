import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  NotificationItemV1,
  NotificationListResponseV1,
  NotificationReadResponseV1,
} from '@rubi/contracts';

import {
  type NotificationRow,
  NotificationsRepository,
} from './notifications.repository';
import type {
  NotificationCommand,
  NotificationTransaction,
} from './notifications.types';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function toItem(row: NotificationRow): NotificationItemV1 {
  return {
    id: row.id,
    sourceModule: row.sourceModule,
    eventType: row.eventType,
    title: row.title,
    message: row.message,
    entityType: row.entityType,
    entityId: row.entityId,
    href: row.href,
    isRead: row.readAt !== null,
    occurredAt: row.occurredAt.toISOString(),
    actor: row.actor,
  };
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NotificationsRepository)
    private readonly repository: NotificationsRepository,
  ) {}

  async list(
    recipientUserId: string,
    requestedLimit?: string,
  ): Promise<NotificationListResponseV1> {
    const limit = requestedLimit ? Number(requestedLimit) : DEFAULT_LIMIT;
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new BadRequestException('تعداد اعلان‌ها باید بین ۱ تا ۵۰ باشد.');
    }
    const result = await this.repository.listForRecipient(
      recipientUserId,
      limit,
    );
    return {
      data: result.rows.map(toItem),
      meta: { unreadCount: result.unreadCount, limit },
    };
  }

  async markRead(
    id: string,
    recipientUserId: string,
  ): Promise<NotificationReadResponseV1> {
    const updatedCount = await this.repository.markRead(id, recipientUserId);
    if (updatedCount < 0) throw new NotFoundException('اعلان پیدا نشد.');
    return { data: { updatedCount } };
  }

  async markAllRead(
    recipientUserId: string,
  ): Promise<NotificationReadResponseV1> {
    const updatedCount = await this.repository.markAllRead(recipientUserId);
    return { data: { updatedCount } };
  }

  async clearRead(
    recipientUserId: string,
  ): Promise<NotificationReadResponseV1> {
    const updatedCount = await this.repository.clearRead(recipientUserId);
    return { data: { updatedCount } };
  }

  async createWithinTransaction(
    transaction: NotificationTransaction,
    command: NotificationCommand,
  ): Promise<void> {
    const recipientUserIds = [...new Set(command.recipientUserIds)];
    if (recipientUserIds.length === 0) return;
    await transaction.notification.createMany({
      data: recipientUserIds.map((recipientUserId) => ({
        recipientUserId,
        actorUserId: command.actorUserId,
        sourceModule: command.sourceModule.slice(0, 80),
        eventType: command.eventType.slice(0, 120),
        title: command.title.slice(0, 200),
        message: command.message.slice(0, 500),
        entityType: command.entityType.slice(0, 80),
        entityId: command.entityId.slice(0, 160),
        href: command.href?.slice(0, 500) ?? null,
      })),
    });
  }
}
