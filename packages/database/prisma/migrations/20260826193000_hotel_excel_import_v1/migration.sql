CREATE TYPE "MasterHotelImportStatus" AS ENUM ('PREVIEW_READY', 'COMMITTING', 'COMPLETED', 'FAILED', 'EXPIRED');
CREATE TYPE "MasterHotelImportDuplicateBehavior" AS ENUM ('SKIP', 'UPDATE', 'CREATE_NEW');

CREATE TABLE "master_meal_services" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "includedMeals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_meal_services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_meal_services_code_key" UNIQUE ("code"),
  CONSTRAINT "master_meal_services_version_check" CHECK ("version" > 0)
);

CREATE TABLE "master_room_types" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "referenceCapacity" INTEGER,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_room_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_room_types_code_key" UNIQUE ("code"),
  CONSTRAINT "master_room_types_capacity_check" CHECK ("referenceCapacity" IS NULL OR "referenceCapacity" > 0),
  CONSTRAINT "master_room_types_version_check" CHECK ("version" > 0)
);

CREATE TABLE "master_facilities" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "category" VARCHAR(80),
  "iconFileReference" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_facilities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_facilities_code_key" UNIQUE ("code"),
  CONSTRAINT "master_facilities_version_check" CHECK ("version" > 0)
);

ALTER TABLE "master_hotels"
  ADD COLUMN "mealServiceId" UUID,
  ADD COLUMN "defaultRoomTypeId" UUID,
  ADD COLUMN "englishName" VARCHAR(160),
  ADD COLUMN "address" VARCHAR(1000),
  ADD COLUMN "description" VARCHAR(2000),
  ADD COLUMN "hotelRules" VARCHAR(2000),
  ADD COLUMN "isSaleableReference" BOOLEAN NOT NULL DEFAULT true,
  ADD CONSTRAINT "master_hotels_mealServiceId_fkey" FOREIGN KEY ("mealServiceId") REFERENCES "master_meal_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_hotels_defaultRoomTypeId_fkey" FOREIGN KEY ("defaultRoomTypeId") REFERENCES "master_room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "master_hotel_facilities" (
  "hotelId" UUID NOT NULL,
  "facilityId" UUID NOT NULL,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId" UUID NOT NULL,
  CONSTRAINT "master_hotel_facilities_pkey" PRIMARY KEY ("hotelId", "facilityId"),
  CONSTRAINT "master_hotel_facilities_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "master_hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "master_hotel_facilities_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "master_facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "master_hotel_import_sessions" (
  "id" UUID NOT NULL,
  "templateVersion" VARCHAR(40) NOT NULL,
  "fileHash" CHAR(64) NOT NULL,
  "originalFileName" VARCHAR(255) NOT NULL,
  "stagingFileName" VARCHAR(100) NOT NULL,
  "actorUserId" UUID NOT NULL,
  "actorBranchId" UUID NOT NULL,
  "countryId" UUID NOT NULL,
  "cityId" UUID NOT NULL,
  "previewTokenHash" CHAR(64) NOT NULL,
  "previewExpiresAt" TIMESTAMPTZ(3) NOT NULL,
  "idempotencyKeyHash" CHAR(64),
  "status" "MasterHotelImportStatus" NOT NULL DEFAULT 'PREVIEW_READY',
  "duplicateBehavior" "MasterHotelImportDuplicateBehavior",
  "mappingSnapshot" JSONB NOT NULL,
  "malwareScanStatus" VARCHAR(40) NOT NULL,
  "rowCount" INTEGER NOT NULL DEFAULT 0,
  "validCount" INTEGER NOT NULL DEFAULT 0,
  "invalidCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "createdCount" INTEGER NOT NULL DEFAULT 0,
  "updatedCount" INTEGER NOT NULL DEFAULT 0,
  "skippedCount" INTEGER NOT NULL DEFAULT 0,
  "errorReport" JSONB,
  "traceId" VARCHAR(120),
  "committedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_hotel_import_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_hotel_import_sessions_stagingFileName_key" UNIQUE ("stagingFileName"),
  CONSTRAINT "master_hotel_import_sessions_previewTokenHash_key" UNIQUE ("previewTokenHash"),
  CONSTRAINT "master_hotel_import_sessions_idempotencyKeyHash_key" UNIQUE ("idempotencyKeyHash"),
  CONSTRAINT "master_hotel_import_sessions_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "master_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "master_hotel_import_sessions_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "master_hotel_import_sessions_counts_check" CHECK ("rowCount" >= 0 AND "validCount" >= 0 AND "invalidCount" >= 0 AND "duplicateCount" >= 0 AND "createdCount" >= 0 AND "updatedCount" >= 0 AND "skippedCount" >= 0)
);

CREATE INDEX "master_meal_services_isActive_name_idx" ON "master_meal_services"("isActive", "name");
CREATE INDEX "master_room_types_isActive_name_idx" ON "master_room_types"("isActive", "name");
CREATE INDEX "master_facilities_isActive_name_idx" ON "master_facilities"("isActive", "name");
CREATE INDEX "master_hotels_mealServiceId_idx" ON "master_hotels"("mealServiceId");
CREATE INDEX "master_hotels_defaultRoomTypeId_idx" ON "master_hotels"("defaultRoomTypeId");
CREATE INDEX "master_hotel_facilities_facilityId_idx" ON "master_hotel_facilities"("facilityId");
CREATE INDEX "master_hotel_import_sessions_actorUserId_createdAt_idx" ON "master_hotel_import_sessions"("actorUserId", "createdAt");
CREATE INDEX "master_hotel_import_sessions_status_previewExpiresAt_idx" ON "master_hotel_import_sessions"("status", "previewExpiresAt");
CREATE INDEX "master_hotel_import_sessions_file_scope_idx" ON "master_hotel_import_sessions"("fileHash", "templateVersion", "countryId", "cityId");
