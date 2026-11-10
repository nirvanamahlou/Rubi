-- Preserve every existing contract policy; standalone issuance uses a real applicant.
CREATE TABLE "reservation_insurance_applicants" (
  "id" UUID NOT NULL PRIMARY KEY,
  "branchId" UUID NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "createdByUserId" UUID NOT NULL REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "requestKey" UUID NOT NULL,
  "requestFingerprint" VARCHAR(64) NOT NULL,
  "displayName" VARCHAR(300) NOT NULL,
  "encryptedData" TEXT NOT NULL,
  "sourceCountryCode" VARCHAR(40) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reservation_insurance_applicant_envelope_check" CHECK (length("encryptedData") > 40)
);
CREATE UNIQUE INDEX "reservation_insurance_applicants_requestKey_key" ON "reservation_insurance_applicants"("requestKey");
CREATE INDEX "reservation_insurance_applicants_branchId_createdAt_idx" ON "reservation_insurance_applicants"("branchId", "createdAt");
CREATE TABLE "reservation_insurance_applicant_access" (
  "id" UUID NOT NULL PRIMARY KEY,
  "applicantId" UUID NOT NULL REFERENCES "reservation_insurance_applicants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorUserId" UUID NOT NULL REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "action" VARCHAR(40) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "reservation_insurance_applicant_access_applicantId_createdAt_idx" ON "reservation_insurance_applicant_access"("applicantId", "createdAt");
ALTER TABLE "reservation_insurance_policies"
  ALTER COLUMN "contractId" DROP NOT NULL,
  ALTER COLUMN "intakeId" DROP NOT NULL,
  ALTER COLUMN "customerId" DROP NOT NULL,
  ADD COLUMN "applicantId" UUID;
CREATE UNIQUE INDEX "reservation_insurance_policies_applicantId_key" ON "reservation_insurance_policies"("applicantId");
ALTER TABLE "reservation_insurance_policies"
  ADD CONSTRAINT "reservation_insurance_policies_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "reservation_insurance_applicants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "reservation_insurance_policy_source_check" CHECK (
    ("applicantId" IS NULL AND "contractId" IS NOT NULL AND "intakeId" IS NOT NULL AND "customerId" IS NOT NULL)
    OR
    ("applicantId" IS NOT NULL AND "contractId" IS NULL AND "intakeId" IS NULL AND "customerId" IS NULL AND automatic = TRUE AND sandbox = TRUE)
  );
