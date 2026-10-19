-- Additive provider-neutral telephony infrastructure. No existing rows are rewritten.
CREATE TABLE "integration_telephony_connections" (
  "id" UUID NOT NULL PRIMARY KEY,
  "branchId" UUID NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "synthetic" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT false,
  "maxAgeSeconds" INTEGER NOT NULL DEFAULT 86400,
  "maxFutureSeconds" INTEGER NOT NULL DEFAULT 120,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "integration_telephony_mappings" (
  "teamId" UUID,
  "id" UUID NOT NULL PRIMARY KEY,
  "connectionId" UUID NOT NULL,
  "extension" VARCHAR(32) NOT NULL,
  "userId" UUID NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "integration_telephony_inbox" (
  "id" UUID NOT NULL PRIMARY KEY,
  "connectionId" UUID NOT NULL,
  "externalFingerprint" CHAR(64) NOT NULL,
  "payloadFingerprint" CHAR(64) NOT NULL,
  "encryptedPayload" TEXT,
  "keyVersion" INTEGER NOT NULL,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "errorCode" VARCHAR(32),
  "processedAt" TIMESTAMPTZ(3)
);
CREATE TABLE "integration_telephony_outbox" (
  "id" UUID NOT NULL PRIMARY KEY,
  "inboxId" UUID NOT NULL,
  "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMPTZ(3)
);
CREATE TABLE "call_center_telephony_sessions" (
  "id" UUID NOT NULL PRIMARY KEY,
  "connectionId" UUID NOT NULL,
  "rootFingerprint" CHAR(64) NOT NULL,
  "callId" UUID NOT NULL,
  "state" VARCHAR(16) NOT NULL,
  "encryptedTechnical" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL,
  "synthetic" BOOLEAN NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "claimUserId" UUID,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "call_center_telephony_offers" (
  "id" UUID NOT NULL PRIMARY KEY,
  "sessionId" UUID NOT NULL,
  "mappingVersion" INTEGER NOT NULL,
  "userId" UUID NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "deferred" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "call_center_telephony_leases" (
  "userId" UUID NOT NULL PRIMARY KEY,
  "tabId" UUID NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "integration_telephony_audit" (
  "id" UUID NOT NULL PRIMARY KEY,
  "connectionId" UUID NOT NULL,
  "actorUserId" UUID,
  "action" VARCHAR(40) NOT NULL,
  "metadata" JSONB NOT NULL,
  "entityId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "integration_telephony_connections" ADD CONSTRAINT "integration_telephony_connections_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_telephony_connections" ADD CONSTRAINT "integration_telephony_connections_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "integration_telephony_mappings_connectionId_extension_key" ON "integration_telephony_mappings"("connectionId","extension");
ALTER TABLE "integration_telephony_mappings" ADD CONSTRAINT "integration_telephony_mappings_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "hr_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_telephony_mappings" ADD CONSTRAINT "integration_telephony_mappings_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "integration_telephony_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_telephony_mappings" ADD CONSTRAINT "integration_telephony_mappings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "integration_telephony_inbox_connectionId_externalFingerprint_key" ON "integration_telephony_inbox"("connectionId","externalFingerprint");
CREATE INDEX "integration_telephony_inbox_status_receivedAt_idx" ON "integration_telephony_inbox"("status","receivedAt");
ALTER TABLE "integration_telephony_inbox" ADD CONSTRAINT "integration_telephony_inbox_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "integration_telephony_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "integration_telephony_outbox_inboxId_key" ON "integration_telephony_outbox"("inboxId");
CREATE INDEX "integration_telephony_outbox_completedAt_availableAt_idx" ON "integration_telephony_outbox"("completedAt","availableAt");
ALTER TABLE "integration_telephony_outbox" ADD CONSTRAINT "integration_telephony_outbox_inboxId_fkey" FOREIGN KEY ("inboxId") REFERENCES "integration_telephony_inbox"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "call_center_telephony_sessions_callId_key" ON "call_center_telephony_sessions"("callId");
CREATE UNIQUE INDEX "call_center_telephony_sessions_connectionId_rootFingerprint_key" ON "call_center_telephony_sessions"("connectionId","rootFingerprint");
CREATE INDEX "call_center_telephony_sessions_completed_updatedAt_id_idx" ON "call_center_telephony_sessions"("completed","updatedAt","id");
ALTER TABLE "call_center_telephony_sessions" ADD CONSTRAINT "call_center_telephony_sessions_claimUserId_fkey" FOREIGN KEY ("claimUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "call_center_telephony_sessions" ADD CONSTRAINT "call_center_telephony_sessions_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "integration_telephony_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "call_center_telephony_sessions" ADD CONSTRAINT "call_center_telephony_sessions_callId_fkey" FOREIGN KEY ("callId") REFERENCES "customer_affairs_calls"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "call_center_telephony_offers_sessionId_userId_key" ON "call_center_telephony_offers"("sessionId","userId");
CREATE INDEX "call_center_telephony_offers_userId_active_createdAt_idx" ON "call_center_telephony_offers"("userId","active","createdAt");
ALTER TABLE "call_center_telephony_offers" ADD CONSTRAINT "call_center_telephony_offers_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "call_center_telephony_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "call_center_telephony_offers" ADD CONSTRAINT "call_center_telephony_offers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "call_center_telephony_leases" ADD CONSTRAINT "call_center_telephony_leases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "integration_telephony_audit_connectionId_createdAt_idx" ON "integration_telephony_audit"("connectionId","createdAt");
ALTER TABLE "integration_telephony_audit" ADD CONSTRAINT "integration_telephony_audit_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "integration_telephony_connections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "integration_telephony_audit" ADD CONSTRAINT "integration_telephony_audit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Widen the existing origin check without changing historical values.
ALTER TABLE customer_affairs_calls DROP CONSTRAINT cc_call_origin_check;
ALTER TABLE customer_affairs_calls ADD CONSTRAINT cc_call_origin_check CHECK (origin IS NULL OR origin IN ('MANUAL','TELEPHONY','SYNTHETIC'));
