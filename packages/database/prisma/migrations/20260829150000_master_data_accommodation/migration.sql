CREATE TYPE "MasterMealServiceCategory" AS ENUM ('MEAL_PLAN', 'SERVICE');

CREATE TABLE "master_hotel_chains" (
  "id" UUID NOT NULL,
  "countryId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "website" VARCHAR(320),
  "logoFileReference" UUID,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_hotel_chains_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_hotel_chains_website_nonblank_check"
    CHECK ("website" IS NULL OR btrim("website") <> '')
);

ALTER TABLE "master_hotels"
  ADD COLUMN "chainId" UUID,
  ADD COLUMN "website" VARCHAR(320),
  ADD COLUMN "checkInTime" CHAR(5),
  ADD COLUMN "checkOutTime" CHAR(5),
  ADD COLUMN "latitude" DECIMAL(9, 6),
  ADD COLUMN "longitude" DECIMAL(9, 6),
  ADD COLUMN "logoFileReference" UUID;

ALTER TABLE "master_meal_services"
  ADD COLUMN "category" "MasterMealServiceCategory" NOT NULL DEFAULT 'MEAL_PLAN';

ALTER TABLE "master_room_types"
  ADD COLUMN "usageDescription" VARCHAR(500);

ALTER TABLE "master_facilities"
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "master_hotel_meal_services" (
  "hotelId" UUID NOT NULL,
  "mealServiceId" UUID NOT NULL,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId" UUID NOT NULL,
  CONSTRAINT "master_hotel_meal_services_pkey" PRIMARY KEY ("hotelId", "mealServiceId")
);

CREATE TABLE "master_hotel_room_types" (
  "hotelId" UUID NOT NULL,
  "roomTypeId" UUID NOT NULL,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId" UUID NOT NULL,
  CONSTRAINT "master_hotel_room_types_pkey" PRIMARY KEY ("hotelId", "roomTypeId")
);

CREATE TABLE "master_composite_hotels" (
  "id" UUID NOT NULL,
  "cityId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "usageCondition" VARCHAR(2000) NOT NULL,
  "isSaleableReference" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_composite_hotels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_composite_hotels_usage_condition_check"
    CHECK (btrim("usageCondition") <> '')
);

CREATE TABLE "master_composite_hotel_members" (
  "compositeHotelId" UUID NOT NULL,
  "hotelId" UUID NOT NULL,
  "priority" INTEGER NOT NULL,
  "isBackup" BOOLEAN NOT NULL DEFAULT false,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId" UUID NOT NULL,
  CONSTRAINT "master_composite_hotel_members_pkey" PRIMARY KEY ("compositeHotelId", "hotelId"),
  CONSTRAINT "master_composite_hotel_members_priority_check" CHECK ("priority" > 0)
);

ALTER TABLE "master_hotels"
  ADD CONSTRAINT "master_hotels_website_nonblank_check"
    CHECK ("website" IS NULL OR btrim("website") <> ''),
  ADD CONSTRAINT "master_hotels_check_in_time_check"
    CHECK ("checkInTime" IS NULL OR "checkInTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "master_hotels_check_out_time_check"
    CHECK ("checkOutTime" IS NULL OR "checkOutTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  ADD CONSTRAINT "master_hotels_coordinate_pair_check"
    CHECK (("latitude" IS NULL) = ("longitude" IS NULL)),
  ADD CONSTRAINT "master_hotels_latitude_check"
    CHECK ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90),
  ADD CONSTRAINT "master_hotels_longitude_check"
    CHECK ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180);

ALTER TABLE "master_facilities"
  ADD CONSTRAINT "master_facilities_display_order_check" CHECK ("displayOrder" >= 0);

CREATE UNIQUE INDEX "master_hotel_chains_code_key" ON "master_hotel_chains"("code");
CREATE INDEX "master_hotel_chains_countryId_isActive_name_idx" ON "master_hotel_chains"("countryId", "isActive", "name");
CREATE INDEX "master_hotels_chainId_isActive_name_idx" ON "master_hotels"("chainId", "isActive", "name");
CREATE INDEX "master_hotels_isSaleableReference_isActive_name_idx" ON "master_hotels"("isSaleableReference", "isActive", "name");
CREATE INDEX "master_meal_services_category_isActive_name_idx" ON "master_meal_services"("category", "isActive", "name");
CREATE INDEX "master_facilities_category_isActive_displayOrder_name_idx" ON "master_facilities"("category", "isActive", "displayOrder", "name");
CREATE INDEX "master_hotel_meal_services_mealServiceId_idx" ON "master_hotel_meal_services"("mealServiceId");
CREATE INDEX "master_hotel_room_types_roomTypeId_idx" ON "master_hotel_room_types"("roomTypeId");
CREATE UNIQUE INDEX "master_composite_hotels_code_key" ON "master_composite_hotels"("code");
CREATE INDEX "master_composite_hotels_cityId_isActive_name_idx" ON "master_composite_hotels"("cityId", "isActive", "name");
CREATE INDEX "master_composite_hotels_isSaleableReference_isActive_name_idx" ON "master_composite_hotels"("isSaleableReference", "isActive", "name");
CREATE UNIQUE INDEX "master_composite_hotel_members_compositeHotelId_priority_key" ON "master_composite_hotel_members"("compositeHotelId", "priority");
CREATE INDEX "master_composite_hotel_members_hotelId_idx" ON "master_composite_hotel_members"("hotelId");

ALTER TABLE "master_hotel_chains"
  ADD CONSTRAINT "master_hotel_chains_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "master_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_hotels"
  ADD CONSTRAINT "master_hotels_chainId_fkey" FOREIGN KEY ("chainId") REFERENCES "master_hotel_chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_hotel_meal_services"
  ADD CONSTRAINT "master_hotel_meal_services_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "master_hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_hotel_meal_services_mealServiceId_fkey" FOREIGN KEY ("mealServiceId") REFERENCES "master_meal_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_hotel_room_types"
  ADD CONSTRAINT "master_hotel_room_types_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "master_hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_hotel_room_types_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "master_room_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_composite_hotels"
  ADD CONSTRAINT "master_composite_hotels_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_composite_hotel_members"
  ADD CONSTRAINT "master_composite_hotel_members_compositeHotelId_fkey" FOREIGN KEY ("compositeHotelId") REFERENCES "master_composite_hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_composite_hotel_members_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "master_hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "master_hotel_meal_services" ("hotelId", "mealServiceId", "assignedByUserId")
SELECT "id", "mealServiceId", "updatedByUserId"
FROM "master_hotels"
WHERE "mealServiceId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "master_hotel_room_types" ("hotelId", "roomTypeId", "assignedByUserId")
SELECT "id", "defaultRoomTypeId", "updatedByUserId"
FROM "master_hotels"
WHERE "defaultRoomTypeId" IS NOT NULL
ON CONFLICT DO NOTHING;
