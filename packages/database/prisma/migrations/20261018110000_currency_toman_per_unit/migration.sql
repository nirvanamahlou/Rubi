-- Independent manual reference: 1 unit of this currency = N tomans.
-- Existing unitsPerUsd values keep their original meaning; no data backfill.
ALTER TABLE "MasterCurrency" ADD COLUMN "tomanPerUnit" DECIMAL(24,10);
ALTER TABLE "MasterCurrency" ADD CONSTRAINT "MasterCurrency_tomanPerUnit_positive"
CHECK ("tomanPerUnit" IS NULL OR ("tomanPerUnit" > 0 AND "tomanPerUnit" < 'Infinity'::numeric));
