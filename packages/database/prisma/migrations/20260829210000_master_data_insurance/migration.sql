-- MASTER-003J-INSURANCE: additive reference catalogs only.
-- Operational insurance policies, prices, contracts and passenger data stay in owner modules.

ALTER TABLE "master_insurers"
  ADD COLUMN "countryId" UUID,
  ADD COLUMN "englishName" VARCHAR(160),
  ADD COLUMN "logoFileReference" UUID;

CREATE TABLE "master_insurance_plans" (
  "id" UUID NOT NULL,
  "insurerId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "destinationRegion" VARCHAR(160) NOT NULL,
  "minimumAge" INTEGER NOT NULL DEFAULT 0,
  "maximumAge" INTEGER,
  "validFrom" TIMESTAMPTZ(3) NOT NULL,
  "validTo" TIMESTAMPTZ(3),
  "description" VARCHAR(1000),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "master_insurance_plans_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_insurance_plans_age_range_check"
    CHECK ("minimumAge" >= 0 AND ("maximumAge" IS NULL OR "maximumAge" >= "minimumAge")),
  CONSTRAINT "master_insurance_plans_validity_check"
    CHECK ("validTo" IS NULL OR "validTo" >= "validFrom"),
  CONSTRAINT "master_insurance_plans_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "master_insurance_coverages" (
  "id" UUID NOT NULL,
  "currencyId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "coverageLimit" DECIMAL(24,10) NOT NULL,
  "deductibleAmount" DECIMAL(24,10) NOT NULL DEFAULT 0,
  "description" VARCHAR(1000),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "master_insurance_coverages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_insurance_coverages_amount_check"
    CHECK ("coverageLimit" > 0 AND "deductibleAmount" >= 0 AND "deductibleAmount" <= "coverageLimit"),
  CONSTRAINT "master_insurance_coverages_version_check" CHECK ("version" >= 1)
);

CREATE TABLE "master_insurance_plan_coverages" (
  "planId" UUID NOT NULL,
  "coverageId" UUID NOT NULL,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId" UUID NOT NULL,

  CONSTRAINT "master_insurance_plan_coverages_pkey" PRIMARY KEY ("planId", "coverageId")
);

CREATE UNIQUE INDEX "master_insurance_plans_code_key"
  ON "master_insurance_plans"("code");
CREATE INDEX "master_insurance_plans_insurerId_isActive_name_idx"
  ON "master_insurance_plans"("insurerId", "isActive", "name");
CREATE INDEX "master_insurance_plans_destinationRegion_isActive_name_idx"
  ON "master_insurance_plans"("destinationRegion", "isActive", "name");
CREATE INDEX "master_insurance_plans_validTo_isActive_idx"
  ON "master_insurance_plans"("validTo", "isActive");

CREATE UNIQUE INDEX "master_insurance_coverages_code_key"
  ON "master_insurance_coverages"("code");
CREATE INDEX "master_insurance_coverages_currencyId_isActive_name_idx"
  ON "master_insurance_coverages"("currencyId", "isActive", "name");
CREATE INDEX "master_insurance_coverages_isActive_name_idx"
  ON "master_insurance_coverages"("isActive", "name");
CREATE INDEX "master_insurance_plan_coverages_coverageId_idx"
  ON "master_insurance_plan_coverages"("coverageId");
CREATE INDEX "master_insurers_countryId_isActive_name_idx"
  ON "master_insurers"("countryId", "isActive", "name");

ALTER TABLE "master_insurers"
  ADD CONSTRAINT "master_insurers_countryId_fkey"
  FOREIGN KEY ("countryId") REFERENCES "master_countries"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_insurance_plans"
  ADD CONSTRAINT "master_insurance_plans_insurerId_fkey"
  FOREIGN KEY ("insurerId") REFERENCES "master_insurers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_insurance_coverages"
  ADD CONSTRAINT "master_insurance_coverages_currencyId_fkey"
  FOREIGN KEY ("currencyId") REFERENCES "master_currencies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_insurance_plan_coverages"
  ADD CONSTRAINT "master_insurance_plan_coverages_planId_fkey"
  FOREIGN KEY ("planId") REFERENCES "master_insurance_plans"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_insurance_plan_coverages"
  ADD CONSTRAINT "master_insurance_plan_coverages_coverageId_fkey"
  FOREIGN KEY ("coverageId") REFERENCES "master_insurance_coverages"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
