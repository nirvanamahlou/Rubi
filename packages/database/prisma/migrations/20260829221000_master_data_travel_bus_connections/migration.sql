-- MASTER-003K-TRAVEL-SERVICES: complete the bus-company provider choice and
-- normalize reusable facilities without replacing any existing bus data.
ALTER TABLE "master_bus_companies"
  ALTER COLUMN "organizationId" DROP NOT NULL,
  ADD COLUMN "supplierId" UUID;

CREATE UNIQUE INDEX "master_bus_companies_supplierId_key"
  ON "master_bus_companies"("supplierId");

ALTER TABLE "master_bus_companies"
  ADD CONSTRAINT "master_bus_companies_connection_check"
  CHECK (num_nonnulls("organizationId", "supplierId") = 1),
  ADD CONSTRAINT "master_bus_companies_supplierId_fkey"
  FOREIGN KEY ("supplierId") REFERENCES "master_suppliers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "master_bus_type_facilities" (
  "busTypeId" UUID NOT NULL,
  "facilityId" UUID NOT NULL,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId" UUID NOT NULL,
  CONSTRAINT "master_bus_type_facilities_pkey"
    PRIMARY KEY ("busTypeId", "facilityId")
);

CREATE INDEX "master_bus_type_facilities_facilityId_idx"
  ON "master_bus_type_facilities"("facilityId");

ALTER TABLE "master_bus_type_facilities"
  ADD CONSTRAINT "master_bus_type_facilities_busTypeId_fkey"
  FOREIGN KEY ("busTypeId") REFERENCES "master_bus_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_bus_type_facilities_facilityId_fkey"
  FOREIGN KEY ("facilityId") REFERENCES "master_facilities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
