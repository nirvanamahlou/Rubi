-- MASTER-004-FORM-ALIGNMENT is intentionally additive and keeps legacy columns
-- so PC-A consumers can migrate without a breaking database transition.

ALTER TABLE "master_cities" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "master_regions"
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "type" SET DEFAULT 'PROVINCE';

ALTER TABLE "master_airports" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_terminals" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_currencies" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "master_banks"
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "logoFileReference" UUID;

ALTER TABLE "master_bank_branches" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "master_organizations"
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "logoFileReference" UUID;

ALTER TABLE "master_suppliers"
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "logoFileReference" UUID,
  ADD COLUMN "name" VARCHAR(160),
  ALTER COLUMN "organizationId" DROP NOT NULL,
  ALTER COLUMN "collaborationStatus" SET DEFAULT 'ACTIVE';

ALTER TABLE "master_travel_services" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_organization_contacts" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_insurers" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_insurance_plans" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_insurance_coverages" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "master_airlines"
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "organizationId" DROP NOT NULL;

ALTER TABLE "master_aircraft_types"
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "bodyType" SET DEFAULT 'OTHER';

ALTER TABLE "master_baggage_rules" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_manifest_templates" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_rail_companies" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_train_types" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_bus_companies" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_bus_types" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_hotels" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_meal_services" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_room_types" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "master_hotel_chains" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "master_composite_hotels"
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
  ALTER COLUMN "usageCondition" DROP NOT NULL;

ALTER TABLE "master_brokers"
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "logoFileReference" UUID,
  ALTER COLUMN "organizationId" DROP NOT NULL,
  ALTER COLUMN "collaborationStatus" SET DEFAULT 'ACTIVE';

ALTER TABLE "master_leaders" ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;
