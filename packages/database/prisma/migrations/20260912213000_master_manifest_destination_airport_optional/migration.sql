-- Existing airport enrichment is preserved, while initial creation no longer invents
-- ICAO/timezone/coordinates. CHECK and UNIQUE constraints continue to validate
-- non-null values when they are added later.
ALTER TABLE "master_airports"
  ALTER COLUMN "icaoCode" DROP NOT NULL,
  ALTER COLUMN "ianaTimezone" DROP NOT NULL,
  ALTER COLUMN "latitude" DROP NOT NULL,
  ALTER COLUMN "longitude" DROP NOT NULL;

-- Legacy templates remain valid with a null destination. New records require the
-- destination at the Master Data service boundary.
ALTER TABLE "master_manifest_templates"
  ADD COLUMN "destinationCityId" UUID,
  ALTER COLUMN "fileFormat" SET DEFAULT 'XLSX',
  ALTER COLUMN "requiredColumns" SET DEFAULT ARRAY[]::TEXT[],
  ALTER COLUMN "columnOrder" SET DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "master_manifest_templates"
  ADD CONSTRAINT "master_manifest_templates_destinationCityId_fkey"
  FOREIGN KEY ("destinationCityId") REFERENCES "master_cities"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "master_manifest_templates_destinationCityId_publicationStatus_isActive_idx"
  ON "master_manifest_templates"("destinationCityId", "publicationStatus", "isActive");
