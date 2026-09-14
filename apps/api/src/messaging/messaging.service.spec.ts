import type { AuthenticatedActor } from '@nora/contracts';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IamService } from '../iam/iam.service';
import type { MessagingRepository } from './messaging.repository';
import { MessagingService } from './messaging.service';

const actor: AuthenticatedActor = {
  userId: '11111111-1111-4111-8111-111111111111',
  sessionId: '22222222-2222-4222-8222-222222222222',
  permissions: [],
  branchIds: ['33333333-3333-4333-8333-333333333333'],
};
const recipientId = '44444444-4444-4444-8444-444444444444';
const conversationId = '55555555-5555-4555-8555-555555555555';
const messageId = '66666666-6666-4666-8666-666666666666';
const now = new Date('2026-09-12T15:00:00.000Z');

const conversation = {
  id: conversationId,
  type: 'DIRECT' as const,
  title: null,
  branchId: actor.branchIds[0]!,
  creatorUserId: actor.userId,
  directPairKey: 'pair',
  createRequestId: 'direct:request-0001',
  createdAt: now,
  updatedAt: now,
  members: [
    { userId: actor.userId, role: 'OWNER' as const, lastReadAt: null },
    { userId: recipientId, role: 'MEMBER' as const, lastReadAt: null },
  ],
  messages: [],
};

describe('MessagingService', () => {
  let repository: Record<string, ReturnType<typeof vi.fn>>;
  let iam: Record<string, ReturnType<typeof vi.fn>>;
  let documents: Record<string, ReturnType<typeof vi.fn>>;
  let service: MessagingService;

  beforeEach(() => {
    repository = {
      listConversations: vi.fn(),
      conversation: vi.fn().mockResolvedValue(conversation),
      createDirect: vi.fn().mockResolvedValue(conversation),
      createGroup: vi.fn(),
      messages: vi.fn(),
      createMessage: vi.fn(),
      sourceMessage: vi.fn(),
      unreadCount: vi.fn().mockResolvedValue(0),
      markRead: vi.fn(),
    };
    iam = {
      validateMessagingRecipients: vi.fn().mockResolvedValue({
        branchId: actor.branchIds[0],
        contacts: [],
      }),
      describeMessagingParticipants: vi.fn().mockResolvedValue([
        { id: actor.userId, displayName: 'فرستنده', username: 'sender' },
        { id: recipientId, displayName: 'گیرنده', username: 'recipient' },
      ]),
    };
    documents = {
      assertWorkbenchOwnedAttachments: vi.fn().mockResolvedValue([]),
    };
    service = new MessagingService(
      repository as unknown as MessagingRepository,
      iam as unknown as IamService,
      documents as never,
    );
  });

  it('creates a branch-scoped direct conversation with a canonical pair key', async () => {
    const response = await service.createDirect(
      { recipientId, clientRequestId: 'direct:request-0001' },
      actor,
    );

    expect(iam.validateMessagingRecipients).toHaveBeenCalledWith(actor, [
      recipientId,
    ]);
    expect(repository.createDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: actor.userId,
        recipientId,
        branchId: actor.branchIds[0],
        directPairKey: expect.stringContaining(actor.branchIds[0]!),
      }),
    );
    expect(response.data.title).toBe('گیرنده');
  });

  it('does not query an empty participant id for ordinary messages', async () => {
    repository.listConversations!.mockResolvedValue([
      {
        ...conversation,
        messages: [
          {
            id: messageId,
            conversationId,
            senderUserId: recipientId,
            body: 'سلام',
            createdAt: now,
            forwardedFrom: null,
            attachments: [],
          },
        ],
      },
    ]);

    await service.conversations(actor);

    expect(iam.describeMessagingParticipants).toHaveBeenCalledWith([
      recipientId,
    ]);
  });

  it('rejects message delivery when the actor is not a destination member', async () => {
    repository.conversation!.mockResolvedValue(null);

    await expect(
      service.send(
        conversationId,
        { body: 'سلام', clientRequestId: 'message:request-0001' },
        actor,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.createMessage).not.toHaveBeenCalled();
  });

  it('validates message files through Documents and notifies other members', async () => {
    const documentId = '88888888-8888-4888-8888-888888888888';
    documents.assertWorkbenchOwnedAttachments!.mockResolvedValue([
      { id: documentId, title: 'فیش واریزی' },
    ]);
    repository.createMessage!.mockResolvedValue({
      id: messageId,
      conversationId,
      senderUserId: actor.userId,
      body: 'پیوست ارسال شد.',
      createdAt: now,
      forwardedFrom: null,
      attachments: [{ documentId, title: 'فیش واریزی' }],
    });
    await service.send(
      conversationId,
      {
        body: 'پیوست ارسال شد.',
        clientRequestId: 'message:request-0002',
        attachmentDocumentIds: [documentId],
      },
      actor,
    );
    expect(documents.assertWorkbenchOwnedAttachments).toHaveBeenCalledWith(
      [documentId],
      'MessagingMessage',
      'message:request-0002',
      actor.branchIds[0],
      actor,
    );
    expect(repository.createMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ documentId, title: 'فیش واریزی' }],
        recipientUserIds: [recipientId],
      }),
    );
  });

  it('forwards the server copy of an accessible source message', async () => {
    repository.sourceMessage!.mockResolvedValue({
      id: messageId,
      conversationId,
      senderUserId: recipientId,
      body: 'متن ثبت‌شده مبدأ',
      createdAt: now,
      forwardedFrom: null,
      attachments: [],
    });
    repository.createMessage!.mockResolvedValue({
      id: '77777777-7777-4777-8777-777777777777',
      conversationId,
      senderUserId: actor.userId,
      body: 'متن ثبت‌شده مبدأ',
      createdAt: now,
      forwardedFrom: { id: messageId, senderUserId: recipientId },
      attachments: [],
    });

    const response = await service.forward(
      conversationId,
      { sourceMessageId: messageId, clientRequestId: 'forward:request-0001' },
      actor,
    );

    expect(repository.createMessage).toHaveBeenCalledWith({
      conversationId,
      senderUserId: actor.userId,
      body: 'متن ثبت‌شده مبدأ',
      forwardedFromMessageId: messageId,
      clientRequestId: 'forward:request-0001',
      attachments: [],
      recipientUserIds: [recipientId],
    });
    expect(response.data.forwardedFrom).toEqual({
      id: messageId,
      senderDisplayName: 'گیرنده',
    });
  });

  it('does not forward a source message outside the actor conversations', async () => {
    repository.sourceMessage!.mockResolvedValue(null);

    await expect(
      service.forward(
        conversationId,
        { sourceMessageId: messageId, clientRequestId: 'forward:request-0001' },
        actor,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.createMessage).not.toHaveBeenCalled();
  });
});
