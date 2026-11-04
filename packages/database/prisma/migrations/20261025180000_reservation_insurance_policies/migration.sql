-- CreateTable
CREATE TABLE "reservation_insurance_policies" (
    "id" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "intakeId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "provider" VARCHAR(32) NOT NULL DEFAULT 'NOYAN',
    "providerId" VARCHAR(100),
    "policyNumber" VARCHAR(100),
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "destinationCode" VARCHAR(40) NOT NULL,
    "planCode" VARCHAR(40) NOT NULL,
    "departureDate" DATE NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "amount" DECIMAL(20,4),
    "currencyCode" VARCHAR(3),
    "notes" VARCHAR(2000) NOT NULL DEFAULT '',
    "version" INTEGER NOT NULL DEFAULT 1,
    "issuedAt" TIMESTAMPTZ(3),
    "cancelledAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reservation_insurance_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reservation_insurance_revisions" (
    "id" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "action" VARCHAR(32) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "actorUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservation_insurance_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservation_insurance_policies_intakeId_status_createdAt_idx" ON "reservation_insurance_policies"("intakeId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_insurance_policies_contractId_customerId_provid_key" ON "reservation_insurance_policies"("contractId", "customerId", "provider");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_insurance_policies_provider_providerId_key" ON "reservation_insurance_policies"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_insurance_policies_provider_policyNumber_key" ON "reservation_insurance_policies"("provider", "policyNumber");

-- CreateIndex
CREATE UNIQUE INDEX "reservation_insurance_revisions_policyId_version_key" ON "reservation_insurance_revisions"("policyId", "version");

-- AddForeignKey
ALTER TABLE "reservation_insurance_policies" ADD CONSTRAINT "reservation_insurance_policies_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "sales_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_insurance_policies" ADD CONSTRAINT "reservation_insurance_policies_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ReservationIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_insurance_policies" ADD CONSTRAINT "reservation_insurance_policies_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_insurance_revisions" ADD CONSTRAINT "reservation_insurance_revisions_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "reservation_insurance_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservation_insurance_revisions" ADD CONSTRAINT "reservation_insurance_revisions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reservation_insurance_policies"
ADD CONSTRAINT "insurance_policy_status_check" CHECK ("status" IN ('DRAFT','INPUT_ERROR','PROVIDER_ERROR','ISSUED','CANCELLED')),
ADD CONSTRAINT "insurance_policy_duration_check" CHECK ("durationDays" BETWEEN 1 AND 365 AND "version" > 0),
ADD CONSTRAINT "insurance_policy_amount_check" CHECK ("amount" IS NULL OR "amount" >= 0),
ADD CONSTRAINT "insurance_policy_confirmed_check" CHECK (
  ("status" IN ('ISSUED','CANCELLED') AND "providerId" IS NOT NULL AND length(trim("providerId")) > 0
    AND "policyNumber" IS NOT NULL AND length(trim("policyNumber")) > 0 AND "issuedAt" IS NOT NULL
    AND "amount" IS NOT NULL AND "currencyCode" IS NOT NULL AND "currencyCode" ~ '^[A-Z]{3}$')
  OR ("status" IN ('DRAFT','INPUT_ERROR','PROVIDER_ERROR') AND "policyNumber" IS NULL AND "issuedAt" IS NULL)
),
ADD CONSTRAINT "insurance_policy_cancelled_check" CHECK (("status" = 'CANCELLED') = ("cancelledAt" IS NOT NULL));
ALTER TABLE "reservation_insurance_revisions" ADD CONSTRAINT "insurance_revision_positive_check" CHECK ("version" > 0);
