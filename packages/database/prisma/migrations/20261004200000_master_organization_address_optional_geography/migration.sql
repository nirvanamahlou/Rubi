ALTER TABLE "master_organization_addresses"
  ALTER COLUMN "countryId" DROP NOT NULL,
  ALTER COLUMN "cityId" DROP NOT NULL;

ALTER TABLE "master_organization_addresses"
  ADD CONSTRAINT "master_organization_addresses_geography_pair_check"
  CHECK (
    ("countryId" IS NULL AND "cityId" IS NULL)
    OR ("countryId" IS NOT NULL AND "cityId" IS NOT NULL)
  );
