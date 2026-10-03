CREATE TYPE "MasterTourScope" AS ENUM ('DOMESTIC', 'INTERNATIONAL', 'BOTH');
CREATE TYPE "MasterTransferServiceMode" AS ENUM ('PRIVATE', 'SHARED');
CREATE TYPE "MasterCipPassengerScope" AS ENUM ('ADT', 'CHD', 'INF', 'ALL');

ALTER TABLE "master_leaders"
  ADD COLUMN "cityId" UUID,
  ADD COLUMN "englishName" VARCHAR(160),
  ADD COLUMN "destinations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "primaryPhoneEncrypted" TEXT,
  ADD COLUMN "primaryPhoneEncryptionIv" VARCHAR(24),
  ADD COLUMN "primaryPhoneEncryptionAuthTag" VARCHAR(24),
  ADD COLUMN "primaryPhoneEncryptionKeyVersion" INTEGER,
  ADD COLUMN "primaryPhoneMasked" VARCHAR(80),
  ADD COLUMN "primaryPhoneFingerprint" CHAR(64),
  ADD COLUMN "roamingPhoneEncrypted" TEXT,
  ADD COLUMN "roamingPhoneEncryptionIv" VARCHAR(24),
  ADD COLUMN "roamingPhoneEncryptionAuthTag" VARCHAR(24),
  ADD COLUMN "roamingPhoneEncryptionKeyVersion" INTEGER,
  ADD COLUMN "roamingPhoneMasked" VARCHAR(80),
  ADD COLUMN "roamingPhoneFingerprint" CHAR(64),
  ADD COLUMN "welcomeSignCode" VARCHAR(80),
  ADD COLUMN "operationalNotes" VARCHAR(1000),
  ADD CONSTRAINT "master_leaders_city_fkey"
    FOREIGN KEY ("cityId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_leaders_version_check" CHECK ("version" >= 1);

CREATE INDEX "master_leaders_cityId_isActive_name_idx"
  ON "master_leaders"("cityId", "isActive", "name");

CREATE TABLE "master_tour_types" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "scope" "MasterTourScope" NOT NULL,
  "description" VARCHAR(1000),
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_tour_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_tour_types_display_order_check" CHECK ("displayOrder" >= 0),
  CONSTRAINT "master_tour_types_version_check" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "master_tour_types_code_key" ON "master_tour_types"("code");
CREATE INDEX "master_tour_types_scope_isActive_displayOrder_name_idx"
  ON "master_tour_types"("scope", "isActive", "displayOrder", "name");

CREATE TABLE "master_transfer_types" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "vehicleType" VARCHAR(120) NOT NULL,
  "serviceMode" "MasterTransferServiceMode" NOT NULL,
  "suggestedCapacity" INTEGER,
  "description" VARCHAR(1000),
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_transfer_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_transfer_types_capacity_check"
    CHECK ("suggestedCapacity" IS NULL OR "suggestedCapacity" BETWEEN 1 AND 100),
  CONSTRAINT "master_transfer_types_display_order_check" CHECK ("displayOrder" >= 0),
  CONSTRAINT "master_transfer_types_version_check" CHECK ("version" >= 1)
);

CREATE UNIQUE INDEX "master_transfer_types_code_key" ON "master_transfer_types"("code");
CREATE INDEX "master_transfer_types_serviceMode_isActive_displayOrder_name_idx"
  ON "master_transfer_types"("serviceMode", "isActive", "displayOrder", "name");

CREATE TABLE "master_cip_services" (
  "id" UUID NOT NULL,
  "airportId" UUID NOT NULL,
  "supplierId" UUID,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "passengerScope" "MasterCipPassengerScope" NOT NULL DEFAULT 'ALL',
  "includedItems" TEXT[] NOT NULL,
  "description" VARCHAR(1000),
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_cip_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_cip_services_items_check" CHECK (cardinality("includedItems") <= 50),
  CONSTRAINT "master_cip_services_display_order_check" CHECK ("displayOrder" >= 0),
  CONSTRAINT "master_cip_services_version_check" CHECK ("version" >= 1),
  CONSTRAINT "master_cip_services_airport_fkey"
    FOREIGN KEY ("airportId") REFERENCES "master_airports"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "master_cip_services_supplier_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "master_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "master_cip_services_code_key" ON "master_cip_services"("code");
CREATE INDEX "master_cip_services_airportId_isActive_displayOrder_name_idx"
  ON "master_cip_services"("airportId", "isActive", "displayOrder", "name");
CREATE INDEX "master_cip_services_supplierId_isActive_idx"
  ON "master_cip_services"("supplierId", "isActive");

CREATE TABLE "master_visa_services" (
  "id" UUID NOT NULL,
  "countryId" UUID NOT NULL,
  "supplierId" UUID,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "visaType" VARCHAR(120) NOT NULL,
  "referenceValidityDays" INTEGER,
  "guidanceFileReference" UUID,
  "description" VARCHAR(1000),
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_visa_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_visa_services_validity_check"
    CHECK ("referenceValidityDays" IS NULL OR "referenceValidityDays" BETWEEN 1 AND 3650),
  CONSTRAINT "master_visa_services_display_order_check" CHECK ("displayOrder" >= 0),
  CONSTRAINT "master_visa_services_version_check" CHECK ("version" >= 1),
  CONSTRAINT "master_visa_services_country_fkey"
    FOREIGN KEY ("countryId") REFERENCES "master_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "master_visa_services_supplier_fkey"
    FOREIGN KEY ("supplierId") REFERENCES "master_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "master_visa_services_code_key" ON "master_visa_services"("code");
CREATE INDEX "master_visa_services_countryId_isActive_displayOrder_name_idx"
  ON "master_visa_services"("countryId", "isActive", "displayOrder", "name");
CREATE INDEX "master_visa_services_supplierId_isActive_idx"
  ON "master_visa_services"("supplierId", "isActive");
