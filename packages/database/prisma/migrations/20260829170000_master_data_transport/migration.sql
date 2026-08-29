ALTER TYPE "MasterOrganizationRoleCode" ADD VALUE IF NOT EXISTS 'RAIL_OPERATOR';

CREATE TYPE "MasterAircraftBodyType" AS ENUM ('NARROW_BODY', 'WIDE_BODY', 'TURBOPROP', 'REGIONAL', 'OTHER');
CREATE TYPE "MasterCabinType" AS ENUM ('ECONOMY', 'PREMIUM_ECONOMY', 'BUSINESS', 'FIRST');
CREATE TYPE "MasterPassengerType" AS ENUM ('ADT', 'CHD', 'INF');
CREATE TYPE "MasterBaggageUnit" AS ENUM ('KG', 'PC');
CREATE TYPE "MasterTransportRouteScope" AS ENUM ('ALL', 'DOMESTIC', 'INTERNATIONAL');
CREATE TYPE "MasterManifestFileFormat" AS ENUM ('XLSX', 'CSV', 'XML', 'JSON');
CREATE TYPE "MasterManifestTemplateStatus" AS ENUM ('DRAFT', 'ACTIVE', 'EXPIRED');
CREATE TYPE "MasterTrainCategory" AS ENUM ('SLEEPER', 'EXPRESS', 'SALOON', 'LUXURY', 'OTHER');
CREATE TYPE "MasterBusServiceClass" AS ENUM ('STANDARD', 'VIP', 'LUXURY', 'OTHER');

ALTER TABLE "master_airlines"
  ADD COLUMN "englishName" VARCHAR(160),
  ADD COLUMN "countryId" UUID,
  ADD COLUMN "logoFileReference" UUID;

CREATE TABLE "master_aircraft_types" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "manufacturer" VARCHAR(120) NOT NULL,
  "model" VARCHAR(120) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "bodyType" "MasterAircraftBodyType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_aircraft_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "master_cabin_classes" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "bookingCode" VARCHAR(8) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "cabinType" "MasterCabinType" NOT NULL,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_cabin_classes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_cabin_classes_display_order_check" CHECK ("displayOrder" >= 0),
  CONSTRAINT "master_cabin_classes_booking_code_check" CHECK ("bookingCode" ~ '^[A-Z0-9]{1,8}$')
);

CREATE TABLE "master_baggage_rules" (
  "id" UUID NOT NULL,
  "airlineId" UUID NOT NULL,
  "cabinClassId" UUID,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "passengerType" "MasterPassengerType" NOT NULL,
  "routeScope" "MasterTransportRouteScope" NOT NULL DEFAULT 'ALL',
  "allowance" DECIMAL(8,2) NOT NULL,
  "unit" "MasterBaggageUnit" NOT NULL,
  "pieceCount" INTEGER,
  "validFrom" DATE NOT NULL,
  "validTo" DATE,
  "description" VARCHAR(500),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_baggage_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_baggage_rules_allowance_check" CHECK ("allowance" > 0),
  CONSTRAINT "master_baggage_rules_piece_count_check" CHECK ("pieceCount" IS NULL OR "pieceCount" > 0),
  CONSTRAINT "master_baggage_rules_validity_check" CHECK ("validTo" IS NULL OR "validTo" >= "validFrom"),
  CONSTRAINT "master_baggage_rules_piece_unit_check" CHECK ("unit" <> 'PC' OR "pieceCount" IS NOT NULL)
);

CREATE TABLE "master_manifest_templates" (
  "id" UUID NOT NULL,
  "airlineId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "versionNumber" INTEGER NOT NULL,
  "fileFormat" "MasterManifestFileFormat" NOT NULL,
  "fileReferenceId" UUID,
  "sheetName" VARCHAR(120),
  "headerRow" INTEGER NOT NULL DEFAULT 1,
  "dateFormat" VARCHAR(40),
  "requiredColumns" TEXT[],
  "columnOrder" TEXT[],
  "validFrom" DATE NOT NULL,
  "validTo" DATE,
  "publicationStatus" "MasterManifestTemplateStatus" NOT NULL DEFAULT 'DRAFT',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_manifest_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_manifest_templates_version_number_check" CHECK ("versionNumber" > 0),
  CONSTRAINT "master_manifest_templates_header_row_check" CHECK ("headerRow" > 0),
  CONSTRAINT "master_manifest_templates_validity_check" CHECK ("validTo" IS NULL OR "validTo" >= "validFrom"),
  CONSTRAINT "master_manifest_templates_active_file_check" CHECK ("publicationStatus" <> 'ACTIVE' OR "fileReferenceId" IS NOT NULL)
);

CREATE TABLE "master_rail_companies" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "countryId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "logoFileReference" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_rail_companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "master_train_types" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "manufacturer" VARCHAR(120) NOT NULL,
  "model" VARCHAR(120) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "category" "MasterTrainCategory" NOT NULL,
  "amenities" TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_train_types_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "master_bus_companies" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "countryId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "logoFileReference" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_bus_companies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "master_bus_types" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "manufacturer" VARCHAR(120) NOT NULL,
  "model" VARCHAR(120) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "serviceClass" "MasterBusServiceClass" NOT NULL,
  "amenities" TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_bus_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "master_aircraft_types_code_key" ON "master_aircraft_types"("code");
CREATE UNIQUE INDEX "master_aircraft_types_manufacturer_model_key" ON "master_aircraft_types"("manufacturer", "model");
CREATE INDEX "master_aircraft_types_bodyType_isActive_name_idx" ON "master_aircraft_types"("bodyType", "isActive", "name");
CREATE UNIQUE INDEX "master_cabin_classes_code_key" ON "master_cabin_classes"("code");
CREATE UNIQUE INDEX "master_cabin_classes_bookingCode_key" ON "master_cabin_classes"("bookingCode");
CREATE INDEX "master_cabin_classes_cabinType_isActive_displayOrder_name_idx" ON "master_cabin_classes"("cabinType", "isActive", "displayOrder", "name");
CREATE UNIQUE INDEX "master_baggage_rules_code_key" ON "master_baggage_rules"("code");
CREATE INDEX "master_baggage_rules_airlineId_cabinClassId_passengerType_routeScope_isActive_idx" ON "master_baggage_rules"("airlineId", "cabinClassId", "passengerType", "routeScope", "isActive");
CREATE INDEX "master_baggage_rules_validFrom_validTo_idx" ON "master_baggage_rules"("validFrom", "validTo");
CREATE UNIQUE INDEX "master_manifest_templates_code_key" ON "master_manifest_templates"("code");
CREATE UNIQUE INDEX "master_manifest_templates_airlineId_versionNumber_key" ON "master_manifest_templates"("airlineId", "versionNumber");
CREATE INDEX "master_manifest_templates_airlineId_publicationStatus_validFrom_validTo_idx" ON "master_manifest_templates"("airlineId", "publicationStatus", "validFrom", "validTo");
CREATE UNIQUE INDEX "master_rail_companies_organizationId_key" ON "master_rail_companies"("organizationId");
CREATE UNIQUE INDEX "master_rail_companies_code_key" ON "master_rail_companies"("code");
CREATE INDEX "master_rail_companies_countryId_isActive_name_idx" ON "master_rail_companies"("countryId", "isActive", "name");
CREATE UNIQUE INDEX "master_train_types_code_key" ON "master_train_types"("code");
CREATE UNIQUE INDEX "master_train_types_manufacturer_model_key" ON "master_train_types"("manufacturer", "model");
CREATE INDEX "master_train_types_category_isActive_name_idx" ON "master_train_types"("category", "isActive", "name");
CREATE UNIQUE INDEX "master_bus_companies_organizationId_key" ON "master_bus_companies"("organizationId");
CREATE UNIQUE INDEX "master_bus_companies_code_key" ON "master_bus_companies"("code");
CREATE INDEX "master_bus_companies_countryId_isActive_name_idx" ON "master_bus_companies"("countryId", "isActive", "name");
CREATE UNIQUE INDEX "master_bus_types_code_key" ON "master_bus_types"("code");
CREATE UNIQUE INDEX "master_bus_types_manufacturer_model_key" ON "master_bus_types"("manufacturer", "model");
CREATE INDEX "master_bus_types_serviceClass_isActive_name_idx" ON "master_bus_types"("serviceClass", "isActive", "name");
CREATE INDEX "master_airlines_countryId_isActive_name_idx" ON "master_airlines"("countryId", "isActive", "name");

ALTER TABLE "master_airlines"
  ADD CONSTRAINT "master_airlines_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "master_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_baggage_rules"
  ADD CONSTRAINT "master_baggage_rules_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "master_airlines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_baggage_rules_cabinClassId_fkey" FOREIGN KEY ("cabinClassId") REFERENCES "master_cabin_classes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_manifest_templates"
  ADD CONSTRAINT "master_manifest_templates_airlineId_fkey" FOREIGN KEY ("airlineId") REFERENCES "master_airlines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_rail_companies"
  ADD CONSTRAINT "master_rail_companies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_rail_companies_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "master_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "master_bus_companies"
  ADD CONSTRAINT "master_bus_companies_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_bus_companies_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "master_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
