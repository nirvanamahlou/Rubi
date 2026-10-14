ALTER TABLE "sales_contract_passengers"
ADD COLUMN "child_age_band" VARCHAR(16);

ALTER TABLE "sales_contract_passengers"
ADD CONSTRAINT "sales_contract_passengers_child_age_band_check"
CHECK ("child_age_band" IS NULL OR
  ("age_category" = 'CHD' AND "child_age_band" IN ('AGE_2_6', 'AGE_6_12')));
