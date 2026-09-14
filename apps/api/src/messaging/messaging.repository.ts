import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@nora/database';

import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

const messageSelection = {
  id: true,
  conversationId: true,
  senderUserId: true,
  body: true,
  createdAt: true,
  forwardedFrom: { select: { id: true, senderUserId: true } },
  attachments: {
    select: { documentId: true, title: true },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.MessagingMessageSelect;

const conversationInclusion = {
  members: {
    select: { userId: true, role: true, lastReadAt: true },
    orderBy: { joinedAt: 'asc' },
  },
  messages: {
    select: messageSelection,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 1,
  },
} satisfies Prisma.MessagingConversationInclude;

@Injectable()
export class MessagingRepository {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(NotificationsService)
    private readonly notifications: NotificationsService,
  ) {}

  listConversations(userId: string, branchIds: string[]) {
    return this.database.client.messagingConversation.findMany({
      where: { branchId: { in: branchIds }, members: { some: { userId } } },
      include: conversationInclusion,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }

  conversation(id: string, userId: string, branchIds: string[]) {
    return this.database.client.messagingConversation.findFirst({
      where: { id, branchId: { in: branchIds }, members: { some: { userId } } },
      include: conversationInclusion,
    });
  }

  async createDirect(input: {
    actorUserId: string;
    recipientId: string;
    branchId: string;
    directPairKey: string;
    clientRequestId: string;
  }) {
    return this.database.client.messagingConversation.upsert({
      where: { directPairKey: input.directPairKey },
      update: {},
      create: {
        type: 'DIRECT',
        branchId: input.branchId,
        creatorUserId: input.actorUserId,
        directPairKey: input.directPairKey,
        createRequestId: input.clientRequestId,
        members: {
          create: [
            { userId: input.actorUserId, role: 'OWNER' },
            { userId: input.recipientId, role: 'MEMBER' },
          ],
        },
      },
      include: conversationInclusion,
    });
  }

  async createGroup(input: {
    actorUserId: string;
    memberIds: string[];
    branchId: string;
    title: string;
    clientRequestId: string;
  }) {
    const existing =
      await this.database.client.messagingConversation.findUnique({
        where: {
          creatorUserId_createRequestId: {
            creatorUserId: input.actorUserId,
            createRequestId: input.clientRequestId,
          },
        },
        include: conversationInclusion,
      });
    if (existing) return existing;
    return this.database.client.messagingConversation.create({
      data: {
        type: 'GROUP',
        branchId: input.branchId,
        creatorUserId: input.actorUserId,
        title: input.title,
        createRequestId: input.clientRequestId,
        members: {
          create: [
            { userId: input.actorUserId, role: 'OWNER' },
            ...input.memberIds.map((userId) => ({
              userId,
              role: 'MEMBER' as const,
            })),
          ],
        },
      },
      include: conversationInclusion,
    });
  }

  async messages(
    conversationId: string,
    cursor: string | undefined,
    take: number,
  ) {
    return this.database.client.messagingMessage.findMany({
      where: { conversationId },
      select: messageSelection,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take,
    });
  }

  markRead(conversationId: string, userId: string) {
    return this.database.client.messagingMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  unreadCount(conversationId: string, userId: string, lastReadAt: Date | null) {
    return this.database.client.messagingMessage.count({
      where: {
        conversationId,
        senderUserId: { not: userId },
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });
  }

  async createMessage(input: {
    conversationId: string;
    senderUserId: string;
    body: string;
    clientRequestId: string;
    forwardedFromMessageId?: string;
    attachments?: Array<{ documentId: string; title: string }>;
    recipientUserIds: string[];
  }) {
    return this.database.client.$transaction(async (transaction) => {
      const existing = await transaction.messagingMessage.findUnique({
        where: {
          conversationId_senderUserId_clientRequestId: {
            conversationId: input.conversationId,
            senderUserId: input.senderUserId,
            clientRequestId: input.clientRequestId,
          },
        },
        select: messageSelection,
      });
      if (existing) return existing;
      const message = await transaction.messagingMessage.upsert({
        where: {
          conversationId_senderUserId_clientRequestId: {
            conversationId: input.conversationId,
            senderUserId: input.senderUserId,
            clientRequestId: input.clientRequestId,
          },
        },
        update: {},
        create: {
          conversationId: input.conversationId,
          senderUserId: input.senderUserId,
          body: input.body,
          clientRequestId: input.clientRequestId,
          ...(input.forwardedFromMessageId
            ? { forwardedFromMessageId: input.forwardedFromMessageId }
            : {}),
        },
        select: messageSelection,
      });
      if (input.attachments?.length) {
        await transaction.messagingMessageAttachment.createMany({
          data: input.attachments.map((attachment) => ({
            messageId: message.id,
            documentId: attachment.documentId,
            title: attachment.title,
          })),
          skipDuplicates: true,
        });
      }
      await transaction.messagingConversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: message.createdAt },
      });
      await this.notifications.createWithinTransaction(transaction, {
        recipientUserIds: input.recipientUserIds,
        actorUserId: input.senderUserId,
        sourceModule: 'messaging',
        eventType: 'message.received',
        title: 'پیام داخلی جدید',
        message: input.body || 'یک فایل برای شما ارسال شد.',
        entityType: 'messaging-conversation',
        entityId: input.conversationId,
        href: `/workbench?tab=messages&conversation=${encodeURIComponent(input.conversationId)}`,
      });
      return transaction.messagingMessage.findUniqueOrThrow({
        where: { id: message.id },
        select: messageSelection,
      });
    });
  }

  sourceMessage(id: string, userId: string, branchIds: string[]) {
    return this.database.client.messagingMessage.findFirst({
      where: {
        id,
        conversation: {
          branchId: { in: branchIds },
          members: { some: { userId } },
        },
      },
      select: messageSelection,
    });
  }
}
