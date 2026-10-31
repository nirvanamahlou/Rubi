-- Historical passenger completion may retain the booked age category without a known birth date.
-- Existing dates and all membership/identity references remain unchanged.
ALTER TABLE "sales_contract_passengers" ALTER COLUMN "birth_date" DROP NOT NULL;
