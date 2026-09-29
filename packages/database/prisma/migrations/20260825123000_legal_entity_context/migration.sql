-- LEGAL-ENTITY-CONTEXT-001: additive issuer company context and immutable output metadata.

CREATE TYPE "LegalEntityContextMode" AS ENUM ('SPECIFIC', 'ALL');
CREATE TYPE "LegalEntityDocumentIssueStatus" AS ENUM ('ISSUED', 'FAILED');

CREATE TABLE "legal_entities" (
  "id" UUID NOT NULL, "code" VARCHAR(40) NOT NULL, "persianName" VARCHAR(200) NOT NULL,
  "latinName" VARCHAR(200), "tradeName" VARCHAR(200), "logoFileId" UUID,
  "letterheadFileId" UUID, "footerFileId" UUID, "address" VARCHAR(500),
  "phone" VARCHAR(80), "email" VARCHAR(320), "website" VARCHAR(320),
  "nationalId" VARCHAR(80), "registrationNumber" VARCHAR(80), "economicCode" VARCHAR(80),
  "paymentText" VARCHAR(1000), "sealFileId" UUID, "authorizedSignatureId" UUID,
  "primaryColor" VARCHAR(16), "secondaryColor" VARCHAR(16), "legalFooterText" VARCHAR(1000),
  "isActive" BOOLEAN NOT NULL DEFAULT true, "version" INTEGER NOT NULL DEFAULT 1,
  "brandingSnapshotVersion" INTEGER NOT NULL DEFAULT 1, "updatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "legal_entities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_legal_entity_contexts" (
  "userId" UUID NOT NULL, "mode" "LegalEntityContextMode" NOT NULL DEFAULT 'SPECIFIC',
  "legalEntityId" UUID, "version" INTEGER NOT NULL DEFAULT 1, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "user_legal_entity_contexts_pkey" PRIMARY KEY ("userId"),
  CONSTRAINT "user_legal_entity_contexts_mode_check" CHECK (
    ("mode" = 'ALL' AND "legalEntityId" IS NULL) OR ("mode" = 'SPECIFIC' AND "legalEntityId" IS NOT NULL)
  )
);

CREATE TABLE "legal_entity_branding_versions" (
  "id" UUID NOT NULL, "legalEntityId" UUID NOT NULL, "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL, "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_entity_branding_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legal_entity_audit_events" (
  "id" UUID NOT NULL, "actorUserId" UUID NOT NULL, "action" VARCHAR(120) NOT NULL,
  "entityId" UUID, "outcome" "AuditOutcome" NOT NULL, "reason" VARCHAR(500),
  "beforeSnapshot" JSONB, "afterSnapshot" JSONB,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "legal_entity_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legal_entity_document_issues" (
  "id" UUID NOT NULL, "issuerLegalEntityId" UUID NOT NULL, "issuerCode" VARCHAR(40) NOT NULL,
  "issuerName" VARCHAR(200) NOT NULL, "brandingSnapshotVersion" INTEGER NOT NULL,
  "brandingSnapshot" JSONB NOT NULL, "templateVersion" VARCHAR(80) NOT NULL,
  "actorUserId" UUID NOT NULL, "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "documentType" VARCHAR(120) NOT NULL, "referenceEntityType" VARCHAR(120) NOT NULL,
  "referenceEntityId" VARCHAR(160) NOT NULL, "fileHash" CHAR(64),
  "status" "LegalEntityDocumentIssueStatus" NOT NULL, "reissueReason" VARCHAR(500),
  "originalIssueId" UUID, CONSTRAINT "legal_entity_document_issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "legal_entities_code_key" ON "legal_entities"("code");
CREATE INDEX "legal_entities_isActive_persianName_idx" ON "legal_entities"("isActive", "persianName");
CREATE INDEX "legal_entities_active_idx" ON "legal_entities"("persianName") WHERE "isActive" = true;
CREATE INDEX "user_legal_entity_contexts_legalEntityId_idx" ON "user_legal_entity_contexts"("legalEntityId");
CREATE UNIQUE INDEX "legal_entity_branding_versions_legalEntityId_version_key" ON "legal_entity_branding_versions"("legalEntityId", "version");
CREATE INDEX "legal_entity_branding_versions_legalEntityId_createdAt_idx" ON "legal_entity_branding_versions"("legalEntityId", "createdAt");
CREATE INDEX "legal_entity_audit_events_entityId_occurredAt_idx" ON "legal_entity_audit_events"("entityId", "occurredAt");
CREATE INDEX "legal_entity_audit_events_actorUserId_occurredAt_idx" ON "legal_entity_audit_events"("actorUserId", "occurredAt");
CREATE INDEX "legal_entity_document_issues_issuerLegalEntityId_issuedAt_idx" ON "legal_entity_document_issues"("issuerLegalEntityId", "issuedAt");
CREATE INDEX "legal_entity_document_issues_referenceEntityType_referenceEntityId_issuedAt_idx" ON "legal_entity_document_issues"("referenceEntityType", "referenceEntityId", "issuedAt");
CREATE INDEX "legal_entity_document_issues_actorUserId_issuedAt_idx" ON "legal_entity_document_issues"("actorUserId", "issuedAt");

ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "iam_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "user_legal_entity_contexts" ADD CONSTRAINT "user_legal_entity_contexts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_legal_entity_contexts" ADD CONSTRAINT "user_legal_entity_contexts_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_entity_branding_versions" ADD CONSTRAINT "legal_entity_branding_versions_legalEntityId_fkey" FOREIGN KEY ("legalEntityId") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_entity_branding_versions" ADD CONSTRAINT "legal_entity_branding_versions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_entity_audit_events" ADD CONSTRAINT "legal_entity_audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_entity_audit_events" ADD CONSTRAINT "legal_entity_audit_events_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_entity_document_issues" ADD CONSTRAINT "legal_entity_document_issues_issuerLegalEntityId_fkey" FOREIGN KEY ("issuerLegalEntityId") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_entity_document_issues" ADD CONSTRAINT "legal_entity_document_issues_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legal_entity_document_issues" ADD CONSTRAINT "legal_entity_document_issues_originalIssueId_fkey" FOREIGN KEY ("originalIssueId") REFERENCES "legal_entity_document_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "legal_entities" ADD CONSTRAINT "legal_entities_version_check" CHECK ("version" > 0 AND "brandingSnapshotVersion" > 0);
ALTER TABLE "legal_entity_document_issues" ADD CONSTRAINT "legal_entity_document_issues_hash_check" CHECK ("fileHash" IS NULL OR "fileHash" ~ '^[0-9a-f]{64}$');
