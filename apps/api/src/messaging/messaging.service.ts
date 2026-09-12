import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  AuthenticatedActor,
  MessagingContactV1,
  MessagingConversationV1,
  MessagingMessageV1,
  MessagingParticipantV1,
} from '@rubi/contracts';

import { IamService } from '../iam/iam.service';
import { MessagingRepository } from './messaging.repository';
import * as validate from './messaging.validation';

type ParticipantDescription = Pick<
  MessagingContactV1,
  'id' | 'displayName' | 'username'
>;

@Injectable()
export class MessagingService {
  constructor(
    @Inject(MessagingRepository)
    private readonly repository: MessagingRepository,
    @Inject(IamService) private readonly iam: IamService,
  ) {}

  async contacts(actor: AuthenticatedActor, query: Record<string, unknown>) {
    const requestedLimit = validate.limit(query.limit);
    const result = await this.iam.listMessagingContacts(
      actor,
      validate.search(query.search),
      requestedLimit,
    );
    return {
      data: result.contacts,
      meta: { hasMore: result.hasMore, limit: requestedLimit },
    };
  }

  async conversations(actor: AuthenticatedActor) {
    const rows = await this.repository.listConversations(
      actor.userId,
      actor.branchIds,
    );
    return { data: await this.mapConversations(rows, actor.userId) };
  }

  async createDirect(body: unknown, actor: AuthenticatedActor) {
    const input = validate.direct(body);
    const { branchId } = await this.iam.validateMessagingRecipients(actor, [
      input.recipientId,
    ]);
    const users = [actor.userId, input.recipientId].sort();
    const row = await this.repository.createDirect({
      actorUserId: actor.userId,
      recipientId: input.recipientId,
      branchId,
      directPairKey: `${branchId}:${users.join(':')}`,
      clientRequestId: input.clientRequestId,
    });
    return { data: await this.mapConversation(row, actor.userId) };
  }

  async createGroup(body: unknown, actor: AuthenticatedActor) {
    const input = validate.group(body);
    const { branchId } = await this.iam.validateMessagingRecipients(
      actor,
      input.memberIds,
    );
    const row = await this.repository.createGroup({
      actorUserId: actor.userId,
      memberIds: input.memberIds,
      branchId,
      title: input.title,
      clientRequestId: input.clientRequestId,
    });
    return { data: await this.mapConversation(row, actor.userId) };
  }

  async messages(
    id: string,
    query: Record<string, unknown>,
    actor: AuthenticatedActor,
  ) {
    const conversationId = validate.uuid(id, 'گفت‌وگو');
    await this.assertConversation(conversationId, actor);
    const requestedLimit = validate.limit(query.limit);
    const cursor =
      query.cursor === undefined
        ? undefined
        : validate.uuid(query.cursor, 'نشانگر');
    const rows = await this.repository.messages(
      conversationId,
      cursor,
      requestedLimit + 1,
    );
    const hasMore = rows.length > requestedLimit;
    const page = rows.slice(0, requestedLimit);
    return {
      data: await this.mapMessages([...page].reverse()),
      meta: { nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null },
    };
  }

  async send(id: string, body: unknown, actor: AuthenticatedActor) {
    const conversationId = validate.uuid(id, 'گفت‌وگو');
    await this.assertConversation(conversationId, actor);
    const input = validate.message(body);
    const row = await this.repository.createMessage({
      conversationId,
      senderUserId: actor.userId,
      body: input.body,
      clientRequestId: input.clientRequestId,
    });
    return { data: await this.mapMessage(row) };
  }

  async forward(id: string, body: unknown, actor: AuthenticatedActor) {
    const conversationId = validate.uuid(id, 'گفت‌وگوی مقصد');
    await this.assertConversation(conversationId, actor);
    const input = validate.forward(body);
    const source = await this.repository.sourceMessage(
      input.sourceMessageId,
      actor.userId,
      actor.branchIds,
    );
    if (!source) throw new NotFoundException('پیام مبدأ در دسترس نیست.');
    const row = await this.repository.createMessage({
      conversationId,
      senderUserId: actor.userId,
      body: source.body,
      forwardedFromMessageId: source.id,
      clientRequestId: input.clientRequestId,
    });
    return { data: await this.mapMessage(row) };
  }

  private async assertConversation(id: string, actor: AuthenticatedActor) {
    const row = await this.repository.conversation(
      id,
      actor.userId,
      actor.branchIds,
    );
    if (!row)
      throw new ForbiddenException('گفت‌وگو در محدوده دسترسی شما نیست.');
    return row;
  }

  private async descriptions(
    ids: string[],
  ): Promise<Map<string, ParticipantDescription>> {
    const users = await this.iam.describeMessagingParticipants(ids);
    return new Map(users.map((user) => [user.id, user]));
  }

  private fallback(id: string): ParticipantDescription {
    return { id, displayName: 'کاربر پیشین', username: 'inactive' };
  }

  private async mapMessages(
    rows: Array<{
      id: string;
      conversationId: string;
      senderUserId: string;
      body: string;
      createdAt: Date;
      forwardedFrom: { id: string; senderUserId: string } | null;
    }>,
  ): Promise<MessagingMessageV1[]> {
    const names = await this.descriptions(
      rows.flatMap((row) => [
        row.senderUserId,
        row.forwardedFrom?.senderUserId ?? '',
      ]),
    );
    return rows.map((row) => {
      const sender =
        names.get(row.senderUserId) ?? this.fallback(row.senderUserId);
      const originalSender = row.forwardedFrom
        ? (names.get(row.forwardedFrom.senderUserId) ??
          this.fallback(row.forwardedFrom.senderUserId))
        : null;
      return {
        id: row.id,
        conversationId: row.conversationId,
        sender,
        body: row.body,
        forwardedFrom:
          row.forwardedFrom && originalSender
            ? {
                id: row.forwardedFrom.id,
                senderDisplayName: originalSender.displayName,
              }
            : null,
        createdAt: row.createdAt.toISOString(),
      };
    });
  }

  private async mapMessage(
    row: Parameters<MessagingService['mapMessages']>[0][number],
  ) {
    return (await this.mapMessages([row]))[0]!;
  }

  private async mapConversations(
    rows: Array<{
      id: string;
      type: 'DIRECT' | 'GROUP';
      title: string | null;
      branchId: string;
      createdAt: Date;
      updatedAt: Date;
      members: Array<{ userId: string; role: 'OWNER' | 'MEMBER' }>;
      messages: Parameters<MessagingService['mapMessages']>[0];
    }>,
    actorUserId: string,
  ): Promise<MessagingConversationV1[]> {
    return Promise.all(
      rows.map((row) => this.mapConversation(row, actorUserId)),
    );
  }

  private async mapConversation(
    row: Parameters<MessagingService['mapConversations']>[0][number],
    actorUserId: string,
  ): Promise<MessagingConversationV1> {
    const names = await this.descriptions(
      row.members.map((member) => member.userId),
    );
    const participants: MessagingParticipantV1[] = row.members.map(
      (member) => ({
        ...(names.get(member.userId) ?? this.fallback(member.userId)),
        role: member.role,
      }),
    );
    const other = participants.find(
      (participant) => participant.id !== actorUserId,
    );
    return {
      id: row.id,
      type: row.type,
      title:
        row.type === 'GROUP'
          ? (row.title ?? 'گروه بدون عنوان')
          : (other?.displayName ?? 'گفت‌وگوی مستقیم'),
      branchId: row.branchId,
      participants,
      lastMessage: (await this.mapMessages(row.messages))[0] ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
