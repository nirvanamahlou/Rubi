-- Additive only; no inference/backfill from legacy ownership or popup claims.
SET lock_timeout = '5s';
CREATE TABLE "call_center_answer_responsibilities" (
  "callId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  "inboxId" uuid NOT NULL,
  "answeredAt" timestamptz(3) NOT NULL,
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "call_center_answer_responsibilities_pkey" PRIMARY KEY ("callId", "userId"),
  CONSTRAINT "call_center_answer_responsibilities_callId_fkey" FOREIGN KEY ("callId") REFERENCES "customer_affairs_calls"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "call_center_answer_responsibilities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "iam_users"(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "call_center_answer_responsibilities_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "integration_telephony_inbox"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "call_center_answer_responsibilities_userId_callId_idx" ON "call_center_answer_responsibilities"("userId", "callId");
CREATE INDEX "call_center_answer_responsibilities_inboxId_idx" ON "call_center_answer_responsibilities"("inboxId");
