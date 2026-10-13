-- Additive; existing references and identifiers remain unchanged.
ALTER TABLE "master_countries"
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_countries"
  ADD CONSTRAINT "master_country_display_order_check"
  CHECK ("displayOrder" >= 0 AND "displayOrder" <= 100000);
