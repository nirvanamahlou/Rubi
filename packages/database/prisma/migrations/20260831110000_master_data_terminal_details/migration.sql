-- Additive terminal metadata. Existing terminals retain unknown hours/gate count.
ALTER TYPE "MasterTerminalType" ADD VALUE 'MIXED';

ALTER TABLE "master_terminals"
  ADD COLUMN "gateCount" INTEGER,
  ADD COLUMN "operatingHoursMode" VARCHAR(16),
  ADD COLUMN "opensAt" CHAR(5),
  ADD COLUMN "closesAt" CHAR(5),
  ADD COLUMN "isUnderMaintenance" BOOLEAN NOT NULL DEFAULT false,
  ADD CONSTRAINT "master_terminals_gate_count_check" CHECK ("gateCount" >= 0),
  ADD CONSTRAINT "master_terminals_maintenance_check" CHECK (NOT "isUnderMaintenance" OR NOT "isActive"),
  ADD CONSTRAINT "master_terminals_hours_check" CHECK ((
    ("operatingHoursMode" IS NULL AND "opensAt" IS NULL AND "closesAt" IS NULL)
    OR ("operatingHoursMode" = 'ALL_DAY' AND "opensAt" IS NULL AND "closesAt" IS NULL)
    OR ("operatingHoursMode" = 'TIME_RANGE'
      AND "opensAt" IS NOT NULL AND "closesAt" IS NOT NULL
      AND "opensAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
      AND "closesAt" ~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
      AND "opensAt" <> "closesAt")
  ) IS TRUE);

COMMENT ON COLUMN "master_terminals"."opensAt" IS 'Recurring local airport time, not a UTC instant; null for unknown or all-day hours.';
COMMENT ON COLUMN "master_terminals"."closesAt" IS 'Recurring local airport time; 24:00 is end of day. Earlier end times mean overnight.';
