import type { BranchReference } from '../iam';

export type MessagingConversationTypeV1 = 'DIRECT' | 'GROUP';
export type MessagingMemberRoleV1 = 'OWNER' | 'MEMBER';
export const messagingReactionEmojisV1 = [
  '👍',
  '❤️',
  '😂',
  '😮',
  '🙏',
] as const;
export type MessagingReactionEmojiV1 =
  (typeof messagingReactionEmojisV1)[number];
export interface MessagingMessageReactionV1 {
  emoji: MessagingReactionEmojiV1;
  count: number;
  userIds: string[];
}
export interface SetMessagingReactionInputV1 {
  emoji: MessagingReactionEmojiV1 | null;
}

export interface MessagingContactV1 {
  id: string;
  displayName: string;
  username: string;
  branches: BranchReference[];
}

export interface MessagingContactsResponseV1 {
  data: MessagingContactV1[];
  meta: { hasMore: boolean; limit: number };
}

export interface MessagingParticipantV1 {
  id: string;
  displayName: string;
  username: string;
  role: MessagingMemberRoleV1;
}

export interface MessagingMessageV1 {
  id: string;
  conversationId: string;
  sender: Pick<MessagingContactV1, 'id' | 'displayName' | 'username'>;
  body: string;
  forwardedFrom: {
    id: string;
    senderDisplayName: string;
  } | null;
  attachments: Array<{ documentId: string; title: string }>;
  replyTo?: {
    id: string;
    body: string;
    sender: Pick<MessagingContactV1, 'id' | 'displayName' | 'username'>;
  } | null;
  reactions?: MessagingMessageReactionV1[];
  createdAt: string;
}

export interface MessagingConversationV1 {
  id: string;
  type: MessagingConversationTypeV1;
  title: string;
  branchId: string;
  participants: MessagingParticipantV1[];
  lastMessage: MessagingMessageV1 | null;
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MessagingConversationsResponseV1 {
  data: MessagingConversationV1[];
}

export interface MessagingMessagesResponseV1 {
  data: MessagingMessageV1[];
  meta: { nextCursor: string | null };
}

export interface MessagingConversationResponseV1 {
  data: MessagingConversationV1;
}

export interface MessagingMessageResponseV1 {
  data: MessagingMessageV1;
}

export interface CreateDirectConversationInputV1 {
  recipientId: string;
  clientRequestId: string;
}

export interface CreateGroupConversationInputV1 {
  title: string;
  memberIds: string[];
  clientRequestId: string;
}

export interface SendMessagingMessageInputV1 {
  body: string;
  clientRequestId: string;
  attachmentDocumentIds?: string[];
  replyToMessageId?: string;
}

export interface ForwardMessagingMessageInputV1 {
  sourceMessageId: string;
  clientRequestId: string;
}
