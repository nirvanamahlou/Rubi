-- Additive, nullable replies preserve existing messages. The composite FK prevents cross-chat references.
ALTER TABLE "messaging_messages" ADD COLUMN "replyToMessageId" UUID;
CREATE UNIQUE INDEX "messaging_messages_id_conversationId_key" ON "messaging_messages"("id", "conversationId");
CREATE INDEX "messaging_messages_replyToMessageId_conversationId_idx" ON "messaging_messages"("replyToMessageId", "conversationId");
ALTER TABLE "messaging_messages" ADD CONSTRAINT "messaging_messages_replyToMessageId_conversationId_fkey" FOREIGN KEY ("replyToMessageId", "conversationId") REFERENCES "messaging_messages"("id", "conversationId") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE TABLE "messaging_message_reactions" (
  "messageId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "emoji" VARCHAR(8) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "messaging_message_reactions_pkey" PRIMARY KEY ("messageId", "userId"),
  CONSTRAINT "messaging_message_reactions_emoji_check" CHECK ("emoji" IN ('👍', '❤️', '😂', '😮', '🙏')),
  CONSTRAINT "messaging_message_reactions_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messaging_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "messaging_message_reactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "messaging_message_reactions_messageId_emoji_idx" ON "messaging_message_reactions"("messageId", "emoji");
