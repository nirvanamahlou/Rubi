-- Expand only: preserve existing capacity, validity, rows and client behavior.
ALTER TABLE "master_transfer_types"
  ADD COLUMN "suggestedCapacityMin" INTEGER,
  ADD CONSTRAINT "master_transfer_types_capacity_range_check"
    CHECK ("suggestedCapacityMin" IS NULL OR (
      "suggestedCapacity" IS NOT NULL
      AND "suggestedCapacityMin" BETWEEN 1 AND 100
      AND "suggestedCapacityMin" <= "suggestedCapacity"
    ));

ALTER TABLE "master_visa_services"
  ADD COLUMN "referenceValidityMode" VARCHAR(24) NOT NULL DEFAULT 'DAYS',
  ADD CONSTRAINT "master_visa_services_validity_mode_check"
    CHECK ("referenceValidityMode" IN ('DAYS', 'PASSPORT_EXPIRY')),
  ADD CONSTRAINT "master_visa_services_validity_mode_days_check"
    CHECK ("referenceValidityMode" <> 'PASSPORT_EXPIRY' OR "referenceValidityDays" IS NULL);
