-- Staging-only counterpart. Do not run on an operational database without explicit approval.
-- Refuses to discard ANY promotion or populated new column, including archived records.
BEGIN;
LOCK TABLE "marketing_assets" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "marketing_assets" WHERE "kind" IN ('COUPON','OFFER')
    OR "target_customer_id" IS NOT NULL OR "target_agency_id" IS NOT NULL
    OR "promotion_value" IS NOT NULL OR "minimum_purchase" IS NOT NULL OR "promotion_currency_code" IS NOT NULL)
  THEN RAISE EXCEPTION 'PROMOTIONS_ROLLBACK_REQUIRES_EMPTY_COLUMNS'; END IF;
END $$;
DROP INDEX "marketing_coupon_code_unique";
ALTER TABLE "marketing_assets" DROP CONSTRAINT "marketing_asset_kind_check",
  DROP CONSTRAINT "marketing_promotion_target_check", DROP CONSTRAINT "marketing_promotion_money_check";
ALTER TABLE "marketing_assets" DROP COLUMN "target_customer_id", DROP COLUMN "target_agency_id",
  DROP COLUMN "promotion_value", DROP COLUMN "minimum_purchase", DROP COLUMN "promotion_currency_code";
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_asset_kind_check"
  CHECK ("kind" IN ('SEGMENT','MESSAGE','SCHEDULE','FORM','LANDING_PAGE','SHORT_LINK','AUTOMATION'));
COMMIT;
