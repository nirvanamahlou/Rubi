import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@rubi/database';

import { DatabaseService } from '../database/database.service';

const messageSelection = {
  id: true,
  conversationId: true,
  senderUserId: true,
  body: true,
  createdAt: true,
  forwardedFrom: { select: { id: true, senderUserId: true } },
} satisfies Prisma.MessagingMessageSelect;

const conversationInclusion = {
  members: {
    select: { userId: true, role: true },
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

  async createMessage(input: {
    conversationId: string;
    senderUserId: string;
    body: string;
    clientRequestId: string;
    forwardedFromMessageId?: string;
  }) {
    return this.database.client.$transaction(async (transaction) => {
      const message = await transaction.messagingMessage.upsert({
        where: {
          conversationId_senderUserId_clientRequestId: {
            conversationId: input.conversationId,
            senderUserId: input.senderUserId,
            clientRequestId: input.clientRequestId,
          },
        },
        update: {},
        create: input,
        select: messageSelection,
      });
      await transaction.messagingConversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: message.createdAt },
      });
      return message;
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
