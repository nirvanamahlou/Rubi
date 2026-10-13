CREATE TYPE "MasterCurrencyRateType" AS ENUM ('BUY', 'SELL', 'REFERENCE');
CREATE TYPE "MasterCurrencyRateStatus" AS ENUM ('DRAFT', 'APPROVED', 'REJECTED', 'EXPIRED');

ALTER TABLE "master_currencies"
  ADD COLUMN "englishName" VARCHAR(160);

ALTER TABLE "master_draft_exchange_rates"
  ADD COLUMN "rateType" "MasterCurrencyRateType" NOT NULL DEFAULT 'REFERENCE',
  ADD COLUMN "validFrom" TIMESTAMPTZ(3),
  ADD COLUMN "validTo" TIMESTAMPTZ(3),
  ADD COLUMN "status" "MasterCurrencyRateStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "correctionReason" VARCHAR(500),
  ADD COLUMN "decisionReason" VARCHAR(500),
  ADD COLUMN "approvedByUserId" UUID,
  ADD COLUMN "approvedAt" TIMESTAMPTZ(3);

UPDATE "master_draft_exchange_rates"
SET "validFrom" = "observedAt"
WHERE "validFrom" IS NULL;

ALTER TABLE "master_draft_exchange_rates"
  ALTER COLUMN "validFrom" SET NOT NULL,
  ADD CONSTRAINT "master_exchange_rate_positive" CHECK ("rate" > 0),
  ADD CONSTRAINT "master_exchange_rate_pair_distinct" CHECK ("fromCurrencyId" <> "toCurrencyId"),
  ADD CONSTRAINT "master_exchange_rate_valid_period" CHECK ("validTo" IS NULL OR "validTo" > "validFrom"),
  ADD CONSTRAINT "master_exchange_rate_not_authoritative" CHECK ("isAuthoritative" = false),
  ADD CONSTRAINT "master_exchange_rate_decision_consistency" CHECK (
    ("status" = 'APPROVED' AND "approvedByUserId" IS NOT NULL AND "approvedAt" IS NOT NULL)
    OR ("status" <> 'APPROVED')
  );

CREATE INDEX "master_draft_exchange_rates_pair_type_status_valid_idx"
  ON "master_draft_exchange_rates"("fromCurrencyId", "toCurrencyId", "rateType", "status", "validFrom");

ALTER TABLE "master_audit_events"
  ADD COLUMN "entityVersion" INTEGER,
  ADD COLUMN "reason" VARCHAR(500);
