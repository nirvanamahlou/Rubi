-- Optional company identity; legacy organizations remain unchanged.
ALTER TABLE "master_organizations" ADD COLUMN "nationalId" VARCHAR(11);
CREATE UNIQUE INDEX "master_organizations_nationalId_key" ON "master_organizations"("nationalId");
ALTER TABLE "master_organizations" ADD CONSTRAINT "master_organizations_national_id_format"
  CHECK ("nationalId" IS NULL OR ("personType" IS NOT DISTINCT FROM 'LEGAL' AND "nationalId" ~ '^[0-9]{11}$'));
