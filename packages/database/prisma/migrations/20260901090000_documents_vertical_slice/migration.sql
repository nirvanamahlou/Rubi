-- DOCUMENTS-002: additive archive metadata and immutable file-version foundation.

CREATE TYPE "DocumentDomain" AS ENUM (
  'CUSTOMER_IDENTITY', 'SALES', 'TRAVEL', 'PROCUREMENT', 'FINANCE',
  'HUMAN_RESOURCES', 'ORGANIZATION', 'REPORTING', 'BRAND', 'GENERAL'
);
CREATE TYPE "DocumentConfidentiality" AS ENUM (
  'PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'
);
CREATE TYPE "DocumentArchiveStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');
CREATE TYPE "DocumentScanStatus" AS ENUM (
  'PENDING_SCAN', 'CLEAN', 'INFECTED', 'SCAN_FAILED', 'QUARANTINED',
  'AWAITING_ANTIVIRUS_ADAPTER'
);
CREATE TYPE "DocumentQuarantineStatus" AS ENUM ('ACTIVE', 'RELEASED', 'REJECTED');
CREATE TYPE "DocumentProcessingStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

CREATE FUNCTION documents_generate_archive_code()
RETURNS text
LANGUAGE sql
VOLATILE
AS $$
  SELECT 'DOC-' || to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDD') || '-' ||
         upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
$$;

CREATE TABLE "document_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "domain" "DocumentDomain" NOT NULL,
  "default_confidentiality" "DocumentConfidentiality" NOT NULL DEFAULT 'INTERNAL',
  "allowed_mime_types" TEXT[] NOT NULL,
  "max_file_size_bytes" BIGINT NOT NULL DEFAULT 26214400,
  "requires_expiry" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "document_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_types_max_file_size_check" CHECK ("max_file_size_bytes" > 0)
);

CREATE TABLE "document_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "parent_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "document_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "archive_code" VARCHAR(40) NOT NULL DEFAULT documents_generate_archive_code(),
  "title" VARCHAR(240) NOT NULL,
  "description" VARCHAR(1000),
  "document_type_id" UUID NOT NULL,
  "category_id" UUID,
  "branch_id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "source_module" VARCHAR(80) NOT NULL,
  "source_entity_type" VARCHAR(120),
  "source_entity_id" VARCHAR(160),
  "confidentiality" "DocumentConfidentiality" NOT NULL DEFAULT 'INTERNAL',
  "archive_status" "DocumentArchiveStatus" NOT NULL DEFAULT 'ACTIVE',
  "valid_until" TIMESTAMPTZ(3),
  "current_version_id" UUID,
  "current_version_number" INTEGER NOT NULL DEFAULT 0,
  "legal_hold_active" BOOLEAN NOT NULL DEFAULT false,
  "deleted_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_user_id" UUID NOT NULL,
  "updated_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "documents_current_version_number_check" CHECK ("current_version_number" >= 0),
  CONSTRAINT "documents_version_check" CHECK ("version" > 0),
  CONSTRAINT "documents_source_reference_pair_check" CHECK (
    ("source_entity_type" IS NULL AND "source_entity_id" IS NULL) OR
    ("source_entity_type" IS NOT NULL AND "source_entity_id" IS NOT NULL)
  ),
  CONSTRAINT "documents_deleted_state_check" CHECK (
    ("archive_status" = 'DELETED' AND "deleted_at" IS NOT NULL) OR
    ("archive_status" <> 'DELETED' AND "deleted_at" IS NULL)
  )
);

CREATE TABLE "document_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL,
  "version_number" INTEGER NOT NULL,
  "storage_object_key" VARCHAR(300) NOT NULL,
  "original_file_name" VARCHAR(255) NOT NULL,
  "safe_download_name" VARCHAR(160) NOT NULL,
  "detected_mime_type" VARCHAR(160) NOT NULL,
  "extension" VARCHAR(16) NOT NULL,
  "size_bytes" BIGINT NOT NULL,
  "sha256" CHAR(64) NOT NULL,
  "scan_status" "DocumentScanStatus" NOT NULL DEFAULT 'PENDING_SCAN',
  "version_note" VARCHAR(500) NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_versions_number_check" CHECK ("version_number" > 0),
  CONSTRAINT "document_versions_size_check" CHECK ("size_bytes" > 0),
  CONSTRAINT "document_versions_sha256_check" CHECK ("sha256" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "document_relations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL,
  "relation_type" VARCHAR(80) NOT NULL,
  "source_module" VARCHAR(80) NOT NULL,
  "source_entity_type" VARCHAR(120) NOT NULL,
  "source_entity_id" VARCHAR(160) NOT NULL,
  "display_label" VARCHAR(240) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_relations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_audit_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "document_id" UUID NOT NULL,
  "version_id" UUID,
  "actor_user_id" UUID NOT NULL,
  "actor_branch_id" UUID NOT NULL,
  "action" VARCHAR(120) NOT NULL,
  "outcome" "AuditOutcome" NOT NULL,
  "reason" VARCHAR(500),
  "ip_summary" VARCHAR(64) NOT NULL,
  "user_agent_summary" VARCHAR(240) NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_quarantines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "version_id" UUID NOT NULL,
  "status" "DocumentQuarantineStatus" NOT NULL DEFAULT 'ACTIVE',
  "reason_code" VARCHAR(120) NOT NULL,
  "quarantined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_by_user_id" UUID,
  "reviewed_at" TIMESTAMPTZ(3),
  "review_reason" VARCHAR(500),
  CONSTRAINT "document_quarantines_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_processing_jobs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "version_id" UUID NOT NULL,
  "job_type" VARCHAR(80) NOT NULL,
  "status" "DocumentProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_error_code" VARCHAR(120),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "document_processing_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "document_processing_jobs_attempts_check" CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "document_types_code_key" ON "document_types"("code");
CREATE INDEX "document_types_domain_is_active_name_idx" ON "document_types"("domain", "is_active", "name");
CREATE UNIQUE INDEX "document_categories_code_key" ON "document_categories"("code");
CREATE INDEX "document_categories_parent_id_is_active_name_idx" ON "document_categories"("parent_id", "is_active", "name");
CREATE UNIQUE INDEX "documents_archive_code_key" ON "documents"("archive_code");
CREATE UNIQUE INDEX "documents_current_version_id_key" ON "documents"("current_version_id");
CREATE INDEX "documents_branch_id_archive_status_updated_at_idx" ON "documents"("branch_id", "archive_status", "updated_at");
CREATE INDEX "documents_document_type_id_archive_status_updated_at_idx" ON "documents"("document_type_id", "archive_status", "updated_at");
CREATE INDEX "documents_category_id_archive_status_updated_at_idx" ON "documents"("category_id", "archive_status", "updated_at");
CREATE INDEX "documents_owner_user_id_updated_at_idx" ON "documents"("owner_user_id", "updated_at");
CREATE INDEX "documents_created_by_user_id_created_at_idx" ON "documents"("created_by_user_id", "created_at");
CREATE INDEX "documents_valid_until_archive_status_idx" ON "documents"("valid_until", "archive_status");
CREATE UNIQUE INDEX "document_versions_storage_object_key_key" ON "document_versions"("storage_object_key");
CREATE UNIQUE INDEX "document_versions_document_id_version_number_key" ON "document_versions"("document_id", "version_number");
CREATE INDEX "document_versions_document_id_created_at_idx" ON "document_versions"("document_id", "created_at");
CREATE INDEX "document_versions_created_by_user_id_created_at_idx" ON "document_versions"("created_by_user_id", "created_at");
CREATE INDEX "document_versions_scan_status_created_at_idx" ON "document_versions"("scan_status", "created_at");
CREATE UNIQUE INDEX "document_relations_document_id_relation_type_source_module_source_entity_type_source_entity_id_key" ON "document_relations"("document_id", "relation_type", "source_module", "source_entity_type", "source_entity_id");
CREATE INDEX "document_relations_source_module_source_entity_type_source_entity_id_idx" ON "document_relations"("source_module", "source_entity_type", "source_entity_id");
CREATE INDEX "document_audit_events_document_id_occurred_at_idx" ON "document_audit_events"("document_id", "occurred_at");
CREATE INDEX "document_audit_events_actor_user_id_occurred_at_idx" ON "document_audit_events"("actor_user_id", "occurred_at");
CREATE INDEX "document_audit_events_actor_branch_id_occurred_at_idx" ON "document_audit_events"("actor_branch_id", "occurred_at");
CREATE INDEX "document_audit_events_version_id_occurred_at_idx" ON "document_audit_events"("version_id", "occurred_at");
CREATE UNIQUE INDEX "document_quarantines_version_id_key" ON "document_quarantines"("version_id");
CREATE INDEX "document_quarantines_status_quarantined_at_idx" ON "document_quarantines"("status", "quarantined_at");
CREATE INDEX "document_quarantines_reviewed_by_user_id_reviewed_at_idx" ON "document_quarantines"("reviewed_by_user_id", "reviewed_at");
CREATE UNIQUE INDEX "document_processing_jobs_version_id_job_type_key" ON "document_processing_jobs"("version_id", "job_type");
CREATE INDEX "document_processing_jobs_status_available_at_idx" ON "document_processing_jobs"("status", "available_at");

ALTER TABLE "document_categories" ADD CONSTRAINT "document_categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "document_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_document_type_id_fkey" FOREIGN KEY ("document_type_id") REFERENCES "document_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "document_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_current_version_id_fkey" FOREIGN KEY ("current_version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_relations" ADD CONSTRAINT "document_relations_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "document_audit_events" ADD CONSTRAINT "document_audit_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_audit_events" ADD CONSTRAINT "document_audit_events_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_audit_events" ADD CONSTRAINT "document_audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_audit_events" ADD CONSTRAINT "document_audit_events_actor_branch_id_fkey" FOREIGN KEY ("actor_branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_quarantines" ADD CONSTRAINT "document_quarantines_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_quarantines" ADD CONSTRAINT "document_quarantines_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_processing_jobs" ADD CONSTRAINT "document_processing_jobs_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
