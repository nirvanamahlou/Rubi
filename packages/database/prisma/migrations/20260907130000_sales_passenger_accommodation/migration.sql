ALTER TABLE "sales_contract_passengers" ADD COLUMN "accommodation_kind" VARCHAR(24);
ALTER TABLE "sales_contract_passengers" ADD CONSTRAINT "sales_passenger_accommodation_kind_check"
CHECK ("accommodation_kind" IS NULL OR "accommodation_kind" IN ('DBL','SINGLE','INFANT','CHILD_WITH_BED','CHILD_WITHOUT_BED'));
