-- CreateEnum
-- Additive evolution of the existing B2B aggregates. Existing rows remain intact.
BEGIN;
CREATE TYPE "B2bReviewStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED');

-- DropIndex
DROP INDEX "b2b_agency_profiles_organization_branch_key";

-- DropIndex
DROP INDEX "b2b_agency_credit_policies_profile_key";

-- AlterTable
ALTER TABLE "b2b_agency_profiles" ADD COLUMN     "role" "MasterOrganizationRoleCode" NOT NULL DEFAULT 'AGENCY';

-- AlterTable
ALTER TABLE "b2b_agency_agreements" ADD COLUMN     "activeRevisionId" UUID;

-- AlterTable
ALTER TABLE "b2b_agency_credit_policies" ADD COLUMN     "dueDays" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "limitType" VARCHAR(8) NOT NULL DEFAULT 'HARD',
ADD COLUMN     "overdueAction" VARCHAR(8) NOT NULL DEFAULT 'BLOCK',
ADD COLUMN     "revisionId" UUID;

-- CreateTable
CREATE TABLE "b2b_agreement_revisions" (
    "id" UUID NOT NULL,
    "agreementId" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "status" "B2bReviewStatus" NOT NULL DEFAULT 'DRAFT',
    "title" VARCHAR(160) NOT NULL,
    "agreementType" VARCHAR(24) NOT NULL,
    "startsAt" DATE NOT NULL,
    "endsAt" DATE,
    "currencyCodes" TEXT[],
    "services" TEXT[],
    "paymentMethod" VARCHAR(16) NOT NULL,
    "settlementCycle" VARCHAR(16) NOT NULL,
    "settlementDays" INTEGER NOT NULL DEFAULT 0,
    "cutoffDay" INTEGER,
    "slaHours" INTEGER,
    "cancellationTerms" VARCHAR(2000) NOT NULL DEFAULT '',
    "refundTerms" VARCHAR(2000) NOT NULL DEFAULT '',
    "notes" VARCHAR(2000) NOT NULL DEFAULT '',
    "changeReason" VARCHAR(500) NOT NULL,
    "documentVersionId" UUID,
    "createdByUserId" UUID NOT NULL,
    "submittedByUserId" UUID,
    "reviewedByUserId" UUID,
    "reviewReason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMPTZ(3),
    "reviewedAt" TIMESTAMPTZ(3),

    CONSTRAINT "b2b_agreement_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_agreement_guarantees" (
    "id" UUID NOT NULL,
    "revisionId" UUID NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "reference" VARCHAR(120) NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "issuer" VARCHAR(160) NOT NULL,
    "receivedAt" DATE NOT NULL,
    "expiresAt" DATE,
    "status" VARCHAR(16) NOT NULL,
    "documentVersionId" UUID,

    CONSTRAINT "b2b_agreement_guarantees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "b2b_agreement_commands" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "fingerprint" CHAR(64) NOT NULL,
    "agreementId" UUID NOT NULL,
    "resultVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "b2b_agreement_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "b2b_agreement_revisions_agreementId_status_idx" ON "b2b_agreement_revisions"("agreementId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_agreement_revisions_agreementId_number_key" ON "b2b_agreement_revisions"("agreementId", "number");

-- CreateIndex
CREATE INDEX "b2b_agreement_guarantees_revisionId_idx" ON "b2b_agreement_guarantees"("revisionId");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_agreement_commands_actorUserId_requestId_key" ON "b2b_agreement_commands"("actorUserId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_agency_profiles_organizationId_branchId_role_key" ON "b2b_agency_profiles"("organizationId", "branchId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_agency_agreements_activeRevisionId_key" ON "b2b_agency_agreements"("activeRevisionId");

-- CreateIndex
CREATE INDEX "b2b_agency_credit_policies_profileId_currencyCode_effective_idx" ON "b2b_agency_credit_policies"("profileId", "currencyCode", "effectiveFrom", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "b2b_agency_credit_policies_revisionId_currencyCode_key" ON "b2b_agency_credit_policies"("revisionId", "currencyCode");

-- AddForeignKey
ALTER TABLE "b2b_agency_agreements" ADD CONSTRAINT "b2b_agency_agreements_activeRevisionId_fkey" FOREIGN KEY ("activeRevisionId") REFERENCES "b2b_agreement_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_agency_credit_policies" ADD CONSTRAINT "b2b_agency_credit_policies_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "b2b_agreement_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_agreement_revisions" ADD CONSTRAINT "b2b_agreement_revisions_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "b2b_agency_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_agreement_revisions" ADD CONSTRAINT "b2b_agreement_revisions_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_agreement_revisions" ADD CONSTRAINT "b2b_agreement_revisions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_agreement_revisions" ADD CONSTRAINT "b2b_agreement_revisions_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_agreement_revisions" ADD CONSTRAINT "b2b_agreement_revisions_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_agreement_guarantees" ADD CONSTRAINT "b2b_agreement_guarantees_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "b2b_agreement_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_agreement_guarantees" ADD CONSTRAINT "b2b_agreement_guarantees_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_agreement_commands" ADD CONSTRAINT "b2b_agreement_commands_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "b2b_agreement_commands" ADD CONSTRAINT "b2b_agreement_commands_agreementId_fkey" FOREIGN KEY ("agreementId") REFERENCES "b2b_agency_agreements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve the single legacy policy while new versions have one row per currency.
CREATE UNIQUE INDEX "b2b_legacy_credit_profile_unique" ON "b2b_agency_credit_policies"("profileId") WHERE "revisionId" IS NULL;
ALTER TABLE "b2b_agency_profiles" ADD CONSTRAINT "b2b_cooperation_role_check" CHECK ("role" IN ('AGENCY','CORPORATE_CUSTOMER'));
ALTER TABLE "b2b_agreement_revisions"
  ALTER COLUMN "currencyCodes" SET NOT NULL,
  ALTER COLUMN "services" SET NOT NULL,
  ADD CONSTRAINT "b2b_revision_terms_check" CHECK (
    "number" > 0 AND length(trim("title")) >= 2 AND length(trim("changeReason")) >= 3
    AND ("endsAt" IS NULL OR "endsAt" >= "startsAt")
    AND cardinality("currencyCodes") BETWEEN 1 AND 12 AND cardinality("services") BETWEEN 1 AND 8
    AND "agreementType" IN ('FRAMEWORK','AGENCY','CORPORATE')
    AND "paymentMethod" IN ('PREPAID','CREDIT','MIXED')
    AND "settlementCycle" IN ('PER_ORDER','WEEKLY','MONTHLY','CUSTOM')
    AND "settlementDays" BETWEEN 0 AND 365
    AND ("cutoffDay" IS NULL OR "cutoffDay" BETWEEN 1 AND 28)
    AND ("slaHours" IS NULL OR "slaHours" BETWEEN 1 AND 720)
  ),
  ADD CONSTRAINT "b2b_revision_review_check" CHECK (
    ("status"='DRAFT' AND "submittedByUserId" IS NULL AND "reviewedByUserId" IS NULL AND "submittedAt" IS NULL AND "reviewedAt" IS NULL)
    OR ("status"='PENDING' AND "submittedByUserId" IS NOT NULL AND "submittedAt" IS NOT NULL AND "reviewedByUserId" IS NULL AND "reviewedAt" IS NULL)
    OR ("status" IN ('APPROVED','REJECTED') AND "submittedByUserId" IS NOT NULL AND "submittedAt" IS NOT NULL
      AND "reviewedByUserId" IS NOT NULL AND "reviewedAt" IS NOT NULL AND length(trim("reviewReason")) >= 3
      AND "reviewedByUserId" <> "createdByUserId" AND "reviewedByUserId" <> "submittedByUserId")
  );
ALTER TABLE "b2b_agency_credit_policies" ADD CONSTRAINT "b2b_credit_revision_terms_check" CHECK (
  "limitType" IN ('HARD','SOFT') AND "overdueAction" IN ('BLOCK','WARN') AND "dueDays" BETWEEN 0 AND 365
);
ALTER TABLE "b2b_agreement_guarantees" ADD CONSTRAINT "b2b_guarantee_terms_check" CHECK (
  "amount" > 0 AND "currencyCode" ~ '^[A-Z]{3}$'
  AND "kind" IN ('BANK_GUARANTEE','CHEQUE','DEPOSIT_REQUIREMENT','OTHER')
  AND "status" IN ('REQUIRED','RECEIVED') AND length(trim("reference")) > 0 AND length(trim("issuer")) >= 2
  AND ("expiresAt" IS NULL OR "expiresAt" >= "receivedAt")
  AND ("status" <> 'RECEIVED' OR ("documentVersionId" IS NOT NULL AND "kind" <> 'DEPOSIT_REQUIREMENT'))
);

-- Submitted content and historical versions are immutable, even outside HTTP.
CREATE FUNCTION b2b_guard_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW."status" <> 'DRAFT' THEN RAISE EXCEPTION 'B2B revision must start as draft'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='DELETE' THEN
    IF OLD."status" <> 'DRAFT' THEN RAISE EXCEPTION 'B2B submitted revision is immutable'; END IF;
    RETURN OLD;
  END IF;
  IF NEW."agreementId" <> OLD."agreementId" OR NEW."number" <> OLD."number" OR NEW."createdByUserId" <> OLD."createdByUserId" OR NEW."createdAt" <> OLD."createdAt" THEN
    RAISE EXCEPTION 'B2B revision identity is immutable';
  END IF;
  IF OLD."status" IN ('APPROVED','REJECTED') THEN RAISE EXCEPTION 'B2B reviewed revision is immutable'; END IF;
  IF OLD."status"='DRAFT' AND NEW."status" NOT IN ('DRAFT','PENDING') THEN RAISE EXCEPTION 'B2B invalid submit transition'; END IF;
  IF OLD."status"='PENDING' THEN
    IF NEW."status" NOT IN ('APPROVED','REJECTED') OR
      (to_jsonb(NEW) - ARRAY['status','reviewedByUserId','reviewedAt','reviewReason']) IS DISTINCT FROM
      (to_jsonb(OLD) - ARRAY['status','reviewedByUserId','reviewedAt','reviewReason']) THEN
      RAISE EXCEPTION 'B2B submitted content is immutable';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER b2b_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON "b2b_agreement_revisions" FOR EACH ROW EXECUTE FUNCTION b2b_guard_revision();

CREATE FUNCTION b2b_guard_revision_child() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE revision_id uuid; revision_status "B2bReviewStatus"; parent_profile uuid; currencies text[];
BEGIN
  IF TG_OP <> 'INSERT' AND OLD."revisionId" IS NOT NULL THEN
    SELECT "status" INTO revision_status FROM "b2b_agreement_revisions" WHERE id=OLD."revisionId" FOR UPDATE;
    IF revision_status <> 'DRAFT' THEN RAISE EXCEPTION 'B2B submitted terms are immutable'; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  revision_id := NEW."revisionId";
  IF revision_id IS NULL THEN RETURN NEW; END IF;
  SELECT r."status", a."profileId", r."currencyCodes" INTO revision_status,parent_profile,currencies
    FROM "b2b_agreement_revisions" r JOIN "b2b_agency_agreements" a ON a.id=r."agreementId" WHERE r.id=revision_id FOR UPDATE OF r;
  IF revision_status <> 'DRAFT' THEN RAISE EXCEPTION 'B2B submitted terms are immutable'; END IF;
  IF NOT NEW."currencyCode" = ANY(currencies) THEN RAISE EXCEPTION 'B2B currency outside contract'; END IF;
  IF TG_TABLE_NAME='b2b_agency_credit_policies' THEN
    IF NEW."profileId" <> parent_profile THEN RAISE EXCEPTION 'B2B credit profile mismatch'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER b2b_credit_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON "b2b_agency_credit_policies" FOR EACH ROW EXECUTE FUNCTION b2b_guard_revision_child();
CREATE TRIGGER b2b_guarantee_revision_guard BEFORE INSERT OR UPDATE OR DELETE ON "b2b_agreement_guarantees" FOR EACH ROW EXECUTE FUNCTION b2b_guard_revision_child();

CREATE FUNCTION b2b_guard_active_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."activeRevisionId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "b2b_agreement_revisions" WHERE id=NEW."activeRevisionId" AND "agreementId"=NEW.id AND "status"='APPROVED'
  ) THEN RAISE EXCEPTION 'B2B active revision must be approved and belong to this agreement'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER b2b_active_revision_guard BEFORE INSERT OR UPDATE ON "b2b_agency_agreements" FOR EACH ROW EXECUTE FUNCTION b2b_guard_active_revision();

-- Permission catalogue only. No assignment to any user or role.
INSERT INTO "iam_permissions" ("id","code","module","name") VALUES
  (gen_random_uuid(),'b2b.agreement.approve','b2b','تأیید مستقل قرارداد همکاری'),
  (gen_random_uuid(),'b2b.credit.approve','b2b','تأیید مستقل سیاست اعتبار')
ON CONFLICT ("code") DO NOTHING;
COMMIT;
