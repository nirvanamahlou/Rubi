import {
  Inject,
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { messagingMentionUsernames } from '@nora/contracts';
import type { Prisma } from '@nora/database';

import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';

const messageSelection = {
  id: true,
  conversationId: true,
  senderUserId: true,
  body: true,
  createdAt: true,
  replyTo: { select: { id: true, body: true, senderUserId: true } },
  reactions: {
    select: { emoji: true, userId: true },
    orderBy: { userId: 'asc' },
  },
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

  async removeMembership(id: string, userId: string, branchIds: string[]) {
    await this.database.client.$transaction(async (tx) => {
      // Serialize membership changes and sends on the conversation row.
      const locked = await tx.messagingConversation.updateMany({
        where: {
          id,
          branchId: { in: branchIds },
          members: { some: { userId } },
        },
        data: { updatedAt: new Date() },
      });
      if (!locked.count) throw new NotFoundException('گفت‌وگو پیدا نشد.');
      const member = await tx.messagingMember.findUnique({
        where: { conversationId_userId: { conversationId: id, userId } },
      });
      if (!member) return;
      await tx.messagingMember.delete({
        where: { conversationId_userId: { conversationId: id, userId } },
      });
      if (member.role === 'OWNER') {
        const next = await tx.messagingMember.findFirst({
          where: { conversationId: id },
          orderBy: [{ joinedAt: 'asc' }, { userId: 'asc' }],
        });
        if (next)
          await tx.messagingMember.update({
            where: {
              conversationId_userId: {
                conversationId: id,
                userId: next.userId,
              },
            },
            data: { role: 'OWNER' },
          });
      }
    });
  }

  async manageGroupMember(
    id: string,
    actorId: string,
    branchIds: string[],
    memberId: string,
    action: 'REMOVE' | 'PROMOTE',
  ) {
    return this.database.client.$transaction(async (tx) => {
      const locked = await tx.messagingConversation.updateMany({
        where: { id, type: 'GROUP', branchId: { in: branchIds } },
        data: { updatedAt: new Date() },
      });
      if (!locked.count) throw new NotFoundException('گفت‌وگو پیدا نشد.');
      const members = await tx.messagingMember.findMany({
        where: { conversationId: id },
      });
      if (
        !members.some(
          (member) => member.userId === actorId && member.role === 'OWNER',
        )
      )
        throw new ForbiddenException(
          'ویرایش گروه فقط برای مدیر گروه مجاز است.',
        );
      if (action === 'REMOVE' && memberId === actorId)
        throw new BadRequestException(
          'برای خروج خودتان از گروه، از گزینه خروج از گروه استفاده کنید.',
        );
      if (!members.some((member) => member.userId === memberId))
        throw new NotFoundException('عضو گروه پیدا نشد.');
      const where = {
        conversationId_userId: { conversationId: id, userId: memberId },
      };
      if (action === 'REMOVE') await tx.messagingMember.delete({ where });
      else await tx.messagingMember.update({ where, data: { role: 'OWNER' } });
      return tx.messagingConversation.findUniqueOrThrow({
        where: { id },
        include: conversationInclusion,
      });
    });
  }

  async updateGroup(
    id: string,
    userId: string,
    branchIds: string[],
    title: string,
    memberIds: string[],
  ) {
    return this.database.client.$transaction(async (tx) => {
      const locked = await tx.messagingConversation.updateMany({
        where: { id, type: 'GROUP', branchId: { in: branchIds } },
        data: { updatedAt: new Date() },
      });
      if (!locked.count) throw new NotFoundException('گفت‌وگو پیدا نشد.');
      const members = await tx.messagingMember.findMany({
        where: { conversationId: id },
      });
      if (!members.some((m) => m.userId === userId && m.role === 'OWNER'))
        throw new ForbiddenException(
          'ویرایش گروه فقط برای مدیر گروه مجاز است.',
        );
      if (new Set([...members.map((m) => m.userId), ...memberIds]).size > 51)
        throw new BadRequestException(
          'گروه باید بین ۱ تا ۵۰ عضو انتخابی داشته باشد.',
        );
      return tx.messagingConversation.update({
        where: { id },
        data: {
          title,
          members: {
            createMany: {
              data: memberIds.map((userId) => ({
                userId,
                role: 'MEMBER' as const,
              })),
              skipDuplicates: true,
            },
          },
        },
        include: conversationInclusion,
      });
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
      update: {
        members: {
          createMany: {
            data: [
              { userId: input.actorUserId, role: 'MEMBER' },
              { userId: input.recipientId, role: 'MEMBER' },
            ],
            skipDuplicates: true,
          },
        },
      },
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
    search = '',
  ) {
    return this.database.client.messagingMessage.findMany({
      where: {
        conversationId,
        ...(search
          ? { body: { contains: search, mode: 'insensitive' as const } }
          : {}),
      },
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
    replyToMessageId?: string;
    attachments?: Array<{ documentId: string; title: string }>;
    recipientUserIds: string[];
  }) {
    return this.database.client.$transaction(async (transaction) => {
      const locked = await transaction.messagingConversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
        include: { members: true },
      });
      if (!locked.members.some((m) => m.userId === input.senderUserId))
        throw new ForbiddenException('عضویت در گفت‌وگو الزامی است.');
      const recipients =
        locked.type === 'DIRECT' && locked.directPairKey
          ? locked.directPairKey
              .split(':')
              .slice(-2)
              .filter((id) => id !== input.senderUserId)
          : locked.members
              .map((m) => m.userId)
              .filter((id) => id !== input.senderUserId);
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
      if (locked.type === 'DIRECT')
        await transaction.messagingMember.createMany({
          data: recipients.map((userId) => ({
            conversationId: input.conversationId,
            userId,
            role: 'MEMBER' as const,
          })),
          skipDuplicates: true,
        });

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
          ...(input.replyToMessageId
            ? { replyToMessageId: input.replyToMessageId }
            : {}),
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
      const names =
        locked.type === 'GROUP' && !input.forwardedFromMessageId
          ? messagingMentionUsernames(input.body)
          : [];
      const mentioned = names.length
        ? await transaction.user.findMany({
            where: {
              id: { in: recipients },
              status: 'ACTIVE',
              username: {
                in: [
                  ...new Set(
                    names.flatMap((name) => [name, name.replace(/\.+$/, '')]),
                  ),
                ],
              },
            },
            select: { id: true, username: true },
          })
        : [];
      const membersByUsername = new Map(
        mentioned.map(({ id, username }) => [username, id]),
      );
      const mentionedIds = new Set(
        names.flatMap((name) => {
          const id =
            membersByUsername.get(name) ??
            membersByUsername.get(name.replace(/\.+$/, ''));
          return id ? [id] : [];
        }),
      );
      const href = `/workbench?tab=messages&conversation=${encodeURIComponent(input.conversationId)}`;
      await this.notifications.createWithinTransaction(transaction, {
        recipientUserIds: recipients.filter((id) => !mentionedIds.has(id)),
        actorUserId: input.senderUserId,
        sourceModule: 'messaging',
        eventType: 'message.received',
        title: 'پیام داخلی جدید',
        message: input.body || 'یک فایل برای شما ارسال شد.',
        entityType: 'messaging-conversation',
        entityId: input.conversationId,
        href,
      });
      if (mentionedIds.size)
        await this.notifications.createWithinTransaction(transaction, {
          recipientUserIds: [...mentionedIds],
          actorUserId: input.senderUserId,
          sourceModule: 'messaging',
          eventType: 'message.mentioned',
          title: 'در گروه به شما اشاره شد',
          message: `${locked.title ?? ''} · ${input.body}`,
          entityType: 'messaging-conversation',
          entityId: input.conversationId,
          href,
        });
      return transaction.messagingMessage.findUniqueOrThrow({
        where: { id: message.id },
        select: messageSelection,
      });
    });
  }

  replyTarget(conversationId: string, messageId: string) {
    return this.database.client.messagingMessage.findFirst({
      where: { id: messageId, conversationId },
      select: { id: true },
    });
  }

  setReaction(
    conversationId: string,
    messageId: string,
    userId: string,
    emoji: string | null,
  ) {
    return this.database.client.$transaction(async (tx) => {
      const message = await tx.messagingMessage.findFirst({
        where: {
          id: messageId,
          conversationId,
          conversation: { members: { some: { userId } } },
        },
        select: { id: true },
      });
      if (!message) throw new NotFoundException('پیام پیدا نشد.');
      if (emoji === null) {
        await tx.messagingMessageReaction.deleteMany({
          where: { messageId, userId },
        });
      } else {
        await tx.messagingMessageReaction.upsert({
          where: { messageId_userId: { messageId, userId } },
          create: { messageId, userId, emoji },
          update: { emoji },
        });
      }
      return tx.messagingMessage.findUniqueOrThrow({
        where: { id: messageId },
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

  attachmentReference(conversationId: string, documentId: string) {
    return this.database.client.messagingMessageAttachment.findFirst({
      where: { documentId, message: { conversationId } },
      select: { messageId: true },
    });
  }
}
