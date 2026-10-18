-- Independent manual reference: 1 unit of this currency = N tomans.
-- Existing unitsPerUsd values keep their original meaning; no data backfill.
BEGIN;
ALTER TABLE "master_currencies" ADD COLUMN "tomanPerUnit" DECIMAL(24,10);
ALTER TABLE "master_currencies" ADD CONSTRAINT "MasterCurrency_tomanPerUnit_positive"
CHECK ("tomanPerUnit" IS NULL OR ("tomanPerUnit" > 0 AND "tomanPerUnit" < 'Infinity'::numeric));
COMMIT;
