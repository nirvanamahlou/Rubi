-- CreateEnum
CREATE TYPE "CustomerKind" AS ENUM ('PERSON', 'ORGANIZATION');

-- CreateEnum
CREATE TYPE "CustomerContactType" AS ENUM ('PHONE', 'EMAIL');

-- CreateEnum
CREATE TYPE "CustomerAddressType" AS ENUM ('HOME', 'WORK', 'BILLING', 'OTHER');

-- CreateEnum
CREATE TYPE "CustomerConsentStatus" AS ENUM ('GRANTED', 'REVOKED');

-- CreateEnum
CREATE TYPE "CustomerConsentPurpose" AS ENUM ('MARKETING');

-- CreateEnum
CREATE TYPE "CustomerConsentChannel" AS ENUM ('SMS', 'EMAIL', 'PHONE', 'ALL');

-- CreateEnum
CREATE TYPE "CustomerRelationshipType" AS ENUM ('FAMILY', 'COMPANION', 'GUARDIAN', 'DEPENDENT');

-- CreateEnum
CREATE TYPE "CustomerDuplicateReviewStatus" AS ENUM ('PENDING', 'CONFIRMED_DISTINCT', 'MERGE_PROPOSED');

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "kind" "CustomerKind" NOT NULL,
    "organizationId" UUID,
    "firstName" VARCHAR(120),
    "lastName" VARCHAR(120),
    "displayName" VARCHAR(200) NOT NULL,
    "birthDate" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCustomer" BOOLEAN NOT NULL DEFAULT true,
    "isPassenger" BOOLEAN NOT NULL DEFAULT false,
    "acquaintanceMethodId" UUID,
    "ownerBranchId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "mergedIntoId" UUID,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "type" "CustomerContactType" NOT NULL,
    "label" VARCHAR(80),
    "maskedValue" VARCHAR(160) NOT NULL,
    "valueHash" CHAR(64) NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMPTZ(3),
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_addresses" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "type" "CustomerAddressType" NOT NULL,
    "label" VARCHAR(240) NOT NULL,
    "cityId" UUID,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_consents" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "purpose" "CustomerConsentPurpose" NOT NULL,
    "channel" "CustomerConsentChannel" NOT NULL,
    "status" "CustomerConsentStatus" NOT NULL,
    "source" VARCHAR(120) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_relationships" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "relatedCustomerId" UUID NOT NULL,
    "relationshipType" "CustomerRelationshipType" NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_status_history" (
    "id" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "fromStatus" VARCHAR(32) NOT NULL,
    "toStatus" VARCHAR(32) NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "changedByUserId" UUID NOT NULL,
    "actorBranchId" UUID NOT NULL,
    "changedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_duplicate_candidates" (
    "id" UUID NOT NULL,
    "sourceCustomerId" UUID NOT NULL,
    "candidateCustomerId" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" TEXT[],
    "reviewStatus" "CustomerDuplicateReviewStatus" NOT NULL DEFAULT 'PENDING',
    "reviewReason" VARCHAR(500),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "reviewedByUserId" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "customer_duplicate_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_audit_events" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "actorBranchId" UUID NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" UUID,
    "outcome" "AuditOutcome" NOT NULL,
    "reason" VARCHAR(500),
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "traceId" VARCHAR(120),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customers_ownerBranchId_isActive_updatedAt_idx" ON "customers"("ownerBranchId", "isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "customers_displayName_idx" ON "customers"("displayName");

-- CreateIndex
CREATE INDEX "customers_organizationId_idx" ON "customers"("organizationId");

-- CreateIndex
CREATE INDEX "customers_acquaintanceMethodId_idx" ON "customers"("acquaintanceMethodId");

-- CreateIndex
CREATE INDEX "customer_contacts_type_valueHash_idx" ON "customer_contacts"("type", "valueHash");

-- CreateIndex
CREATE INDEX "customer_contacts_customerId_isPrimary_idx" ON "customer_contacts"("customerId", "isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "customer_contacts_customerId_type_valueHash_key" ON "customer_contacts"("customerId", "type", "valueHash");

-- CreateIndex
CREATE INDEX "customer_addresses_customerId_isPrimary_idx" ON "customer_addresses"("customerId", "isPrimary");

-- CreateIndex
CREATE INDEX "customer_addresses_cityId_idx" ON "customer_addresses"("cityId");

-- CreateIndex
CREATE INDEX "customer_consents_customerId_purpose_channel_occurredAt_idx" ON "customer_consents"("customerId", "purpose", "channel", "occurredAt");

-- CreateIndex
CREATE INDEX "customer_relationships_relatedCustomerId_idx" ON "customer_relationships"("relatedCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_relationships_customerId_relatedCustomerId_relatio_key" ON "customer_relationships"("customerId", "relatedCustomerId", "relationshipType");

-- CreateIndex
CREATE INDEX "customer_status_history_customerId_changedAt_idx" ON "customer_status_history"("customerId", "changedAt");

-- CreateIndex
CREATE INDEX "customer_duplicate_candidates_reviewStatus_createdAt_idx" ON "customer_duplicate_candidates"("reviewStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "customer_duplicate_candidates_sourceCustomerId_candidateCus_key" ON "customer_duplicate_candidates"("sourceCustomerId", "candidateCustomerId");

-- CreateIndex
CREATE INDEX "customer_audit_events_entityType_entityId_occurredAt_idx" ON "customer_audit_events"("entityType", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "customer_audit_events_actorUserId_occurredAt_idx" ON "customer_audit_events"("actorUserId", "occurredAt");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_acquaintanceMethodId_fkey" FOREIGN KEY ("acquaintanceMethodId") REFERENCES "master_acquaintance_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_ownerBranchId_fkey" FOREIGN KEY ("ownerBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_deactivatedByUserId_fkey" FOREIGN KEY ("deactivatedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_addresses" ADD CONSTRAINT "customer_addresses_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_consents" ADD CONSTRAINT "customer_consents_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_relationships" ADD CONSTRAINT "customer_relationships_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_relationships" ADD CONSTRAINT "customer_relationships_relatedCustomerId_fkey" FOREIGN KEY ("relatedCustomerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_relationships" ADD CONSTRAINT "customer_relationships_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_status_history" ADD CONSTRAINT "customer_status_history_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_status_history" ADD CONSTRAINT "customer_status_history_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_status_history" ADD CONSTRAINT "customer_status_history_actorBranchId_fkey" FOREIGN KEY ("actorBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_duplicate_candidates" ADD CONSTRAINT "customer_duplicate_candidates_sourceCustomerId_fkey" FOREIGN KEY ("sourceCustomerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_duplicate_candidates" ADD CONSTRAINT "customer_duplicate_candidates_candidateCustomerId_fkey" FOREIGN KEY ("candidateCustomerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_duplicate_candidates" ADD CONSTRAINT "customer_duplicate_candidates_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_duplicate_candidates" ADD CONSTRAINT "customer_duplicate_candidates_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_audit_events" ADD CONSTRAINT "customer_audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_audit_events" ADD CONSTRAINT "customer_audit_events_actorBranchId_fkey" FOREIGN KEY ("actorBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Customer integrity constraints not expressible in Prisma schema
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_at_least_one_role_check" CHECK ("isCustomer" OR "isPassenger"),
  ADD CONSTRAINT "customers_version_positive_check" CHECK ("version" > 0),
  ADD CONSTRAINT "customers_kind_shape_check" CHECK (
    ("kind" = 'PERSON' AND "firstName" IS NOT NULL AND "lastName" IS NOT NULL AND "organizationId" IS NULL)
    OR ("kind" = 'ORGANIZATION' AND "organizationId" IS NOT NULL)
  );

ALTER TABLE "customer_relationships"
  ADD CONSTRAINT "customer_relationships_no_self_check" CHECK ("customerId" <> "relatedCustomerId");

ALTER TABLE "customer_duplicate_candidates"
  ADD CONSTRAINT "customer_duplicate_candidates_no_self_check" CHECK ("sourceCustomerId" <> "candidateCustomerId"),
  ADD CONSTRAINT "customer_duplicate_candidates_score_check" CHECK ("score" BETWEEN 0 AND 100),
  ADD CONSTRAINT "customer_duplicate_candidates_version_positive_check" CHECK ("version" > 0);