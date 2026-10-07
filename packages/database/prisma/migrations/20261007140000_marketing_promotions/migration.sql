ALTER TABLE "marketing_assets"
  ADD COLUMN "target_customer_id" UUID,
  ADD COLUMN "target_agency_id" UUID,
  ADD COLUMN "promotion_value" DECIMAL(24,4),
  ADD COLUMN "minimum_purchase" DECIMAL(24,4),
  ADD COLUMN "promotion_currency_code" CHAR(3);

ALTER TABLE "marketing_assets" DROP CONSTRAINT "marketing_asset_kind_check";
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_asset_kind_check"
  CHECK ("kind" IN ('SEGMENT','MESSAGE','SCHEDULE','FORM','LANDING_PAGE','SHORT_LINK','AUTOMATION','COUPON','OFFER'));
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_promotion_target_check"
  CHECK (("target_customer_id" IS NULL OR "target_agency_id" IS NULL)
    AND ("kind" IN ('COUPON','OFFER') OR ("target_customer_id" IS NULL AND "target_agency_id" IS NULL)));
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_promotion_money_check"
  CHECK ("kind" NOT IN ('COUPON','OFFER') OR
    ("promotion_value" IS NOT NULL AND "promotion_value" > 0
      AND "minimum_purchase" IS NOT NULL AND "minimum_purchase" >= 0
      AND "promotion_currency_code" IS NOT NULL AND "promotion_currency_code" ~ '^[A-Z]{3}$'));
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_target_customer_id_fkey"
  FOREIGN KEY ("target_customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_assets_target_agency_id_fkey"
  FOREIGN KEY ("target_agency_id") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "marketing_assets_target_customer_id_idx" ON "marketing_assets"("target_customer_id");
CREATE INDEX "marketing_assets_target_agency_id_idx" ON "marketing_assets"("target_agency_id");
CREATE UNIQUE INDEX "marketing_coupon_code_unique" ON "marketing_assets" ("branch_id", upper("payload"->>'code')) WHERE "kind" = 'COUPON' AND "status" <> 'DELETED';
