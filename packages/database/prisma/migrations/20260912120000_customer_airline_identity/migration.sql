ALTER TABLE "customers"
  ADD COLUMN "passportFirstName" VARCHAR(120),
  ADD COLUMN "passportLastName" VARCHAR(120),
  ADD COLUMN "gender" CHAR(1),
  ADD COLUMN "nationalityCode" CHAR(3),
  ADD COLUMN "passportIssuingCountryCode" CHAR(3),
  ADD COLUMN "birthCountryCode" CHAR(3),
  ADD CONSTRAINT "customers_gender_check" CHECK ("gender" IS NULL OR "gender" IN ('M', 'F')),
  ADD CONSTRAINT "customers_nationality_code_check" CHECK ("nationalityCode" IS NULL OR "nationalityCode" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "customers_passport_issuing_country_code_check" CHECK ("passportIssuingCountryCode" IS NULL OR "passportIssuingCountryCode" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "customers_birth_country_code_check" CHECK ("birthCountryCode" IS NULL OR "birthCountryCode" ~ '^[A-Z]{3}$');
