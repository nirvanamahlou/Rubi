BEGIN;
ALTER TABLE "master_currencies" ADD COLUMN "unitsPerUsd" DECIMAL(24,10);
ALTER TABLE "master_currencies" ADD CONSTRAINT "master_currency_units_per_usd_check"
CHECK ("unitsPerUsd" IS NULL OR ("unitsPerUsd" > 0 AND "unitsPerUsd" < 'Infinity'::numeric AND ("code" <> 'USD' OR "unitsPerUsd" = 1)));
COMMIT;
