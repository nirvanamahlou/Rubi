CREATE TYPE "MasterRegionType" AS ENUM ('PROVINCE', 'STATE', 'REGION', 'TERRITORY');
CREATE TYPE "MasterTerminalType" AS ENUM ('DOMESTIC', 'INTERNATIONAL', 'VIP');

ALTER TABLE "master_countries"
  ADD CONSTRAINT "master_countries_iso2_format_check"
    CHECK ("code" = UPPER("code") AND "code" ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT "master_countries_version_positive_check"
    CHECK ("version" > 0);

ALTER TABLE "master_cities"
  ADD COLUMN "regionId" UUID,
  ADD COLUMN "englishName" VARCHAR(160);

UPDATE "master_cities"
SET "englishName" = "name"
WHERE "englishName" IS NULL;

ALTER TABLE "master_cities"
  ALTER COLUMN "englishName" SET NOT NULL,
  ADD CONSTRAINT "master_cities_version_positive_check"
    CHECK ("version" > 0);

CREATE TABLE "master_regions" (
  "id" UUID NOT NULL,
  "countryId" UUID NOT NULL,
  "parentRegionId" UUID,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160) NOT NULL,
  "type" "MasterRegionType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_regions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_regions_countryId_code_key" UNIQUE ("countryId", "code"),
  CONSTRAINT "master_regions_id_countryId_key" UNIQUE ("id", "countryId"),
  CONSTRAINT "master_regions_parent_not_self_check"
    CHECK ("parentRegionId" IS NULL OR "parentRegionId" <> "id"),
  CONSTRAINT "master_regions_version_positive_check"
    CHECK ("version" > 0),
  CONSTRAINT "master_regions_countryId_fkey"
    FOREIGN KEY ("countryId") REFERENCES "master_countries"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "master_regions_parent_same_country_fkey"
    FOREIGN KEY ("parentRegionId", "countryId")
    REFERENCES "master_regions"("id", "countryId")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "master_cities"
  ADD CONSTRAINT "master_cities_region_same_country_fkey"
    FOREIGN KEY ("regionId", "countryId")
    REFERENCES "master_regions"("id", "countryId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "master_airports" (
  "id" UUID NOT NULL,
  "cityId" UUID NOT NULL,
  "iataCode" CHAR(3) NOT NULL,
  "icaoCode" CHAR(4) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160) NOT NULL,
  "ianaTimezone" VARCHAR(80) NOT NULL,
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_airports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_airports_iataCode_key" UNIQUE ("iataCode"),
  CONSTRAINT "master_airports_icaoCode_key" UNIQUE ("icaoCode"),
  CONSTRAINT "master_airports_iata_format_check"
    CHECK ("iataCode" = UPPER("iataCode") AND "iataCode" ~ '^[A-Z]{3}$'),
  CONSTRAINT "master_airports_icao_format_check"
    CHECK ("icaoCode" = UPPER("icaoCode") AND "icaoCode" ~ '^[A-Z]{4}$'),
  CONSTRAINT "master_airports_iana_timezone_format_check"
    CHECK ("ianaTimezone" = 'UTC' OR "ianaTimezone" ~ '^[A-Za-z_]+(/[A-Za-z0-9_+-]+)+$'),
  CONSTRAINT "master_airports_latitude_range_check"
    CHECK ("latitude" BETWEEN -90 AND 90),
  CONSTRAINT "master_airports_longitude_range_check"
    CHECK ("longitude" BETWEEN -180 AND 180),
  CONSTRAINT "master_airports_version_positive_check"
    CHECK ("version" > 0),
  CONSTRAINT "master_airports_cityId_fkey"
    FOREIGN KEY ("cityId") REFERENCES "master_cities"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "master_terminals" (
  "id" UUID NOT NULL,
  "airportId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "terminalType" "MasterTerminalType" NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_terminals_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_terminals_airportId_code_key" UNIQUE ("airportId", "code"),
  CONSTRAINT "master_terminals_version_positive_check"
    CHECK ("version" > 0),
  CONSTRAINT "master_terminals_airportId_fkey"
    FOREIGN KEY ("airportId") REFERENCES "master_airports"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "master_regions_country_type_active_name_idx"
  ON "master_regions"("countryId", "type", "isActive", "name");
CREATE INDEX "master_regions_parent_active_name_idx"
  ON "master_regions"("parentRegionId", "isActive", "name");
CREATE INDEX "master_cities_regionId_isActive_name_idx"
  ON "master_cities"("regionId", "isActive", "name");
CREATE INDEX "master_airports_cityId_isActive_name_idx"
  ON "master_airports"("cityId", "isActive", "name");
CREATE INDEX "master_airports_ianaTimezone_isActive_idx"
  ON "master_airports"("ianaTimezone", "isActive");
CREATE INDEX "master_terminals_airport_type_active_name_idx"
  ON "master_terminals"("airportId", "terminalType", "isActive", "name");
