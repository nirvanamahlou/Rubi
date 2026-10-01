CREATE TABLE "master_rail_terminals" (
    "id" UUID NOT NULL,
    "cityId" UUID,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "englishName" VARCHAR(160),
    "logoFileReference" UUID,
    "operatingHoursMode" VARCHAR(16),
    "opensAt" CHAR(5),
    "closesAt" CHAR(5),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "master_rail_terminals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "master_rail_terminals_hours_check" CHECK (
      ("operatingHoursMode" IS NULL AND "opensAt" IS NULL AND "closesAt" IS NULL) OR
      ("operatingHoursMode" = 'FULL_TIME' AND "opensAt" IS NULL AND "closesAt" IS NULL) OR
      ("operatingHoursMode" = 'LIMITED' AND "opensAt" IS NOT NULL AND "closesAt" IS NOT NULL AND "opensAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "closesAt" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
    )
);

CREATE UNIQUE INDEX "master_rail_terminals_code_key" ON "master_rail_terminals"("code");
CREATE INDEX "master_rail_terminals_cityId_isActive_displayOrder_name_idx" ON "master_rail_terminals"("cityId", "isActive", "displayOrder", "name");
CREATE INDEX "master_rail_terminals_isActive_displayOrder_name_idx" ON "master_rail_terminals"("isActive", "displayOrder", "name");
ALTER TABLE "master_rail_terminals" ADD CONSTRAINT "master_rail_terminals_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
