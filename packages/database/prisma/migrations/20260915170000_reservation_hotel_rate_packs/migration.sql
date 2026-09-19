CREATE TABLE "reservation_hotel_rate_packs" (
  "id" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "cityId" UUID NOT NULL,
  "checkIn" DATE NOT NULL,
  "checkOut" DATE NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "method" VARCHAR(16) NOT NULL,
  "currentVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reservation_hotel_rate_packs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_hotel_rate_packs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservation_hotel_rate_packs_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservation_hotel_rate_packs_valid_dates" CHECK ("checkOut" > "checkIn"),
  CONSTRAINT "reservation_hotel_rate_packs_positive_version" CHECK ("currentVersion" > 0)
);

CREATE INDEX "reservation_hotel_rate_packs_branchId_cityId_checkIn_checkOut_idx"
  ON "reservation_hotel_rate_packs"("branchId", "cityId", "checkIn", "checkOut");

ALTER TABLE "reservation_hotel_rate_batches"
  ADD COLUMN "packId" UUID,
  ADD COLUMN "cityId" UUID,
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "reservation_hotel_rate_batches"
  ADD CONSTRAINT "reservation_hotel_rate_batches_packId_fkey"
    FOREIGN KEY ("packId") REFERENCES "reservation_hotel_rate_packs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "reservation_hotel_rate_batches_cityId_fkey"
    FOREIGN KEY ("cityId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "reservation_hotel_rate_batches_positive_version" CHECK ("version" > 0),
  ADD CONSTRAINT "reservation_hotel_rate_batches_pack_city_pair" CHECK (("packId" IS NULL) = ("cityId" IS NULL));

CREATE UNIQUE INDEX "reservation_hotel_rate_batches_packId_version_key"
  ON "reservation_hotel_rate_batches"("packId", "version");
