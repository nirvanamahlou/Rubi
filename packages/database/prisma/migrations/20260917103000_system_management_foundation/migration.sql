CREATE TYPE "SystemScope" AS ENUM ('GLOBAL', 'LEGAL_ENTITY', 'BRANCH', 'USER');
CREATE TYPE "SystemValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');
CREATE TYPE "SystemRecordStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "SystemBackupStatus" AS ENUM ('REQUESTED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');
CREATE TYPE "SystemAdminOperationStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'EXECUTING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

CREATE TABLE "system_settings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "namespace" VARCHAR(80) NOT NULL,
  "key" VARCHAR(120) NOT NULL,
  "valueType" "SystemValueType" NOT NULL,
  "scope" "SystemScope" NOT NULL,
  "scopeId" UUID,
  "scopeKey" VARCHAR(80) NOT NULL,
  "activeVersion" INTEGER NOT NULL DEFAULT 1,
  "status" "SystemRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_settings_activeVersion_check" CHECK ("activeVersion" > 0),
  CONSTRAINT "system_settings_scope_check" CHECK (
    ("scope" = 'GLOBAL' AND "scopeId" IS NULL AND "scopeKey" = 'GLOBAL') OR
    ("scope" <> 'GLOBAL' AND "scopeId" IS NOT NULL)
  )
);

CREATE TABLE "system_setting_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "settingId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "value" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_setting_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_setting_versions_version_check" CHECK ("version" > 0)
);

CREATE TABLE "system_numbering_schemes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL,
  "scope" "SystemScope" NOT NULL,
  "scopeId" UUID,
  "scopeKey" VARCHAR(80) NOT NULL,
  "prefix" VARCHAR(40) NOT NULL,
  "calendar" VARCHAR(20) NOT NULL DEFAULT 'JALALI',
  "includeFiscalYear" BOOLEAN NOT NULL DEFAULT true,
  "includeLegalEntity" BOOLEAN NOT NULL DEFAULT false,
  "includeBranch" BOOLEAN NOT NULL DEFAULT false,
  "padding" INTEGER NOT NULL DEFAULT 6,
  "resetPolicy" VARCHAR(20) NOT NULL DEFAULT 'YEARLY',
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "reason" TEXT NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "system_numbering_schemes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_numbering_padding_check" CHECK ("padding" BETWEEN 1 AND 16),
  CONSTRAINT "system_numbering_calendar_check" CHECK ("calendar" IN ('JALALI', 'GREGORIAN')),
  CONSTRAINT "system_numbering_reset_check" CHECK ("resetPolicy" IN ('NEVER', 'YEARLY', 'MONTHLY'))
);

CREATE TABLE "system_numbering_sequences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schemeId" UUID NOT NULL,
  "periodKey" VARCHAR(20) NOT NULL,
  "lastValue" BIGINT NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "system_numbering_sequences_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_numbering_sequences_value_check" CHECK ("lastValue" >= 0),
  CONSTRAINT "system_numbering_sequences_version_check" CHECK ("version" > 0)
);

CREATE TABLE "system_issued_numbers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schemeId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "issuedValue" VARCHAR(160) NOT NULL,
  "sequenceValue" BIGINT NOT NULL,
  "periodKey" VARCHAR(20) NOT NULL,
  "actorUserId" UUID NOT NULL,
  "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_issued_numbers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_notification_channels" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "channel" VARCHAR(40) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "templateRef" VARCHAR(160),
  "quietHoursStart" VARCHAR(5),
  "quietHoursEnd" VARCHAR(5),
  "retryPolicy" JSONB NOT NULL DEFAULT '{}',
  "providerStatus" VARCHAR(40) NOT NULL DEFAULT 'NOT_CONFIGURED',
  "version" INTEGER NOT NULL DEFAULT 1,
  "reason" TEXT NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "system_notification_channels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_message_templates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(120) NOT NULL,
  "kind" VARCHAR(30) NOT NULL,
  "language" VARCHAR(12) NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "SystemRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "subject" VARCHAR(300),
  "body" TEXT NOT NULL,
  "allowedVariables" JSONB NOT NULL DEFAULT '[]',
  "reason" TEXT NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "publishedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_message_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_feature_flags" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "key" VARCHAR(120) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(500),
  "scope" "SystemScope" NOT NULL,
  "scopeId" UUID,
  "scopeKey" VARCHAR(80) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "rolloutPercent" INTEGER,
  "startsAt" TIMESTAMPTZ(3),
  "endsAt" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "reason" TEXT NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "system_feature_flags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_feature_flags_rollout_check" CHECK ("rolloutPercent" IS NULL OR "rolloutPercent" BETWEEN 0 AND 100),
  CONSTRAINT "system_feature_flags_window_check" CHECK ("startsAt" IS NULL OR "endsAt" IS NULL OR "startsAt" < "endsAt")
);

CREATE TABLE "system_backup_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "type" VARCHAR(30) NOT NULL,
  "status" "SystemBackupStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedByUserId" UUID NOT NULL,
  "reason" TEXT NOT NULL,
  "retentionUntil" TIMESTAMPTZ(3),
  "sanitizedResult" TEXT,
  "sanitizedError" TEXT,
  "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "system_backup_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_backup_request_type_check" CHECK ("type" IN ('FULL', 'DATABASE', 'FILES'))
);

CREATE TABLE "system_admin_operations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "kind" VARCHAR(80) NOT NULL,
  "status" "SystemAdminOperationStatus" NOT NULL DEFAULT 'REQUESTED',
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "reason" TEXT NOT NULL,
  "requestedByUserId" UUID NOT NULL,
  "approvedByUserId" UUID,
  "errorCode" VARCHAR(80),
  "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMPTZ(3),
  "executedAt" TIMESTAMPTZ(3),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "system_admin_operations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "system_admin_operations_checker_check" CHECK ("approvedByUserId" IS NULL OR "approvedByUserId" <> "requestedByUserId")
);

CREATE TABLE "system_health_snapshots" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "component" VARCHAR(40) NOT NULL,
  "status" VARCHAR(30) NOT NULL,
  "latencyMs" INTEGER,
  "detail" VARCHAR(500) NOT NULL,
  "metrics" JSONB NOT NULL DEFAULT '{}',
  "capturedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_health_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actorUserId" UUID NOT NULL,
  "action" VARCHAR(120) NOT NULL,
  "entityType" VARCHAR(80) NOT NULL,
  "entityId" VARCHAR(160) NOT NULL,
  "outcome" VARCHAR(20) NOT NULL,
  "reason" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "requestId" VARCHAR(120),
  "ipAddressMasked" VARCHAR(80),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "system_settings_namespace_key_scopeKey_key" ON "system_settings"("namespace", "key", "scopeKey");
CREATE INDEX "system_settings_namespace_key_status_idx" ON "system_settings"("namespace", "key", "status");
CREATE UNIQUE INDEX "system_setting_versions_settingId_version_key" ON "system_setting_versions"("settingId", "version");
CREATE INDEX "system_setting_versions_createdByUserId_createdAt_idx" ON "system_setting_versions"("createdByUserId", "createdAt");
CREATE UNIQUE INDEX "system_numbering_schemes_code_scopeKey_key" ON "system_numbering_schemes"("code", "scopeKey");
CREATE INDEX "system_numbering_schemes_isActive_code_idx" ON "system_numbering_schemes"("isActive", "code");
CREATE UNIQUE INDEX "system_numbering_sequences_schemeId_periodKey_key" ON "system_numbering_sequences"("schemeId", "periodKey");
CREATE UNIQUE INDEX "system_issued_numbers_issuedValue_key" ON "system_issued_numbers"("issuedValue");
CREATE UNIQUE INDEX "system_issued_numbers_schemeId_idempotencyKey_key" ON "system_issued_numbers"("schemeId", "idempotencyKey");
CREATE INDEX "system_issued_numbers_actorUserId_issuedAt_idx" ON "system_issued_numbers"("actorUserId", "issuedAt");
CREATE UNIQUE INDEX "system_notification_channels_channel_key" ON "system_notification_channels"("channel");
CREATE UNIQUE INDEX "system_message_templates_key_language_version_key" ON "system_message_templates"("key", "language", "version");
CREATE INDEX "system_message_templates_key_language_status_idx" ON "system_message_templates"("key", "language", "status");
CREATE UNIQUE INDEX "system_feature_flags_key_scopeKey_key" ON "system_feature_flags"("key", "scopeKey");
CREATE INDEX "system_feature_flags_enabled_startsAt_endsAt_idx" ON "system_feature_flags"("enabled", "startsAt", "endsAt");
CREATE INDEX "system_backup_requests_status_requestedAt_idx" ON "system_backup_requests"("status", "requestedAt");
CREATE INDEX "system_backup_requests_requestedByUserId_requestedAt_idx" ON "system_backup_requests"("requestedByUserId", "requestedAt");
CREATE UNIQUE INDEX "system_admin_operations_idempotencyKey_key" ON "system_admin_operations"("idempotencyKey");
CREATE INDEX "system_admin_operations_status_requestedAt_idx" ON "system_admin_operations"("status", "requestedAt");
CREATE INDEX "system_admin_operations_requestedByUserId_requestedAt_idx" ON "system_admin_operations"("requestedByUserId", "requestedAt");
CREATE INDEX "system_health_snapshots_component_capturedAt_idx" ON "system_health_snapshots"("component", "capturedAt");
CREATE INDEX "system_audit_events_createdAt_id_idx" ON "system_audit_events"("createdAt", "id");
CREATE INDEX "system_audit_events_actorUserId_createdAt_idx" ON "system_audit_events"("actorUserId", "createdAt");
CREATE INDEX "system_audit_events_entityType_entityId_createdAt_idx" ON "system_audit_events"("entityType", "entityId", "createdAt");

ALTER TABLE "system_setting_versions" ADD CONSTRAINT "system_setting_versions_settingId_fkey" FOREIGN KEY ("settingId") REFERENCES "system_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "system_numbering_sequences" ADD CONSTRAINT "system_numbering_sequences_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "system_numbering_schemes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "system_issued_numbers" ADD CONSTRAINT "system_issued_numbers_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "system_numbering_schemes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
