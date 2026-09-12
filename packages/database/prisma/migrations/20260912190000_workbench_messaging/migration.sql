CREATE TYPE "MessagingConversationType" AS ENUM ('DIRECT', 'GROUP');
CREATE TYPE "MessagingMemberRole" AS ENUM ('OWNER', 'MEMBER');

CREATE TABLE "messaging_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" "MessagingConversationType" NOT NULL,
  "title" VARCHAR(160),
  "branchId" UUID NOT NULL,
  "creatorUserId" UUID NOT NULL,
  "directPairKey" VARCHAR(140),
  "createRequestId" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "messaging_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messaging_conversations_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "messaging_conversations_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "messaging_conversations_shape_check" CHECK (
    ("type" = 'DIRECT' AND "title" IS NULL AND "directPairKey" IS NOT NULL)
    OR ("type" = 'GROUP' AND char_length(trim("title")) >= 2 AND "directPairKey" IS NULL)
  )
);

CREATE UNIQUE INDEX "messaging_conversations_directPairKey_key" ON "messaging_conversations"("directPairKey");
CREATE UNIQUE INDEX "messaging_conversations_creatorUserId_createRequestId_key" ON "messaging_conversations"("creatorUserId", "createRequestId");
CREATE INDEX "messaging_conversations_branchId_updatedAt_idx" ON "messaging_conversations"("branchId", "updatedAt");

CREATE TABLE "messaging_members" (
  "conversationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "role" "MessagingMemberRole" NOT NULL DEFAULT 'MEMBER',
  "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_members_pkey" PRIMARY KEY ("conversationId", "userId"),
  CONSTRAINT "messaging_members_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "messaging_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "messaging_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "messaging_members_userId_joinedAt_idx" ON "messaging_members"("userId", "joinedAt");

CREATE TABLE "messaging_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversationId" UUID NOT NULL,
  "senderUserId" UUID NOT NULL,
  "body" VARCHAR(4000) NOT NULL,
  "forwardedFromMessageId" UUID,
  "clientRequestId" VARCHAR(80) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messaging_messages_body_check" CHECK (char_length(trim("body")) BETWEEN 1 AND 4000),
  CONSTRAINT "messaging_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "messaging_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "messaging_messages_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "messaging_messages_forwardedFromMessageId_fkey" FOREIGN KEY ("forwardedFromMessageId") REFERENCES "messaging_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "messaging_messages_conversationId_senderUserId_clientRequestId_key" ON "messaging_messages"("conversationId", "senderUserId", "clientRequestId");
CREATE INDEX "messaging_messages_conversationId_createdAt_id_idx" ON "messaging_messages"("conversationId", "createdAt", "id");
CREATE INDEX "messaging_messages_forwardedFromMessageId_idx" ON "messaging_messages"("forwardedFromMessageId");
