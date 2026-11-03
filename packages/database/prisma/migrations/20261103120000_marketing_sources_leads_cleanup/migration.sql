ALTER TABLE "marketing_campaigns" ADD COLUMN "deleted_at" TIMESTAMPTZ(3);
ALTER TABLE "customer_affairs_marketing_intakes"
  ADD COLUMN "first_name" VARCHAR(100),
  ADD COLUMN "last_name" VARCHAR(100),
  ADD COLUMN "entry_date" TIMESTAMPTZ(3);
ALTER TABLE "marketing_assets" DROP CONSTRAINT "marketing_asset_kind_check";
ALTER TABLE "marketing_assets" ADD CONSTRAINT "marketing_asset_kind_check"
  CHECK ("kind" IN ('SEGMENT','MESSAGE','SCHEDULE','FORM','LANDING_PAGE','SHORT_LINK','AUTOMATION','COUPON','OFFER','SOURCE','AUDIENCE'));
