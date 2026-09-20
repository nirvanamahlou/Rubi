-- Add room-type-specific hotel rates and enforce capacity at the database boundary.
CREATE TABLE "reservation_hotel_room_rates" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "groupRateId" UUID NOT NULL,
  "roomTypeId" UUID NOT NULL,
  "roomTypeName" VARCHAR(160) NOT NULL,
  "factor" DECIMAL(12,3) NOT NULL,
  "maxAdults" INTEGER NOT NULL,
  "maxChildren" INTEGER NOT NULL,
  CONSTRAINT "reservation_hotel_room_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_hotel_room_rates_factor_check" CHECK ("factor" > 0),
  CONSTRAINT "reservation_hotel_room_rates_capacity_check" CHECK ("maxAdults" BETWEEN 1 AND 20 AND "maxChildren" BETWEEN 0 AND 20)
);

CREATE UNIQUE INDEX "reservation_hotel_room_rates_groupRateId_roomTypeId_key"
  ON "reservation_hotel_room_rates"("groupRateId", "roomTypeId");
CREATE INDEX "reservation_hotel_room_rates_roomTypeId_groupRateId_idx"
  ON "reservation_hotel_room_rates"("roomTypeId", "groupRateId");

ALTER TABLE "reservation_hotel_room_rates"
  ADD CONSTRAINT "reservation_hotel_room_rates_groupRateId_fkey"
  FOREIGN KEY ("groupRateId") REFERENCES "reservation_hotel_group_rates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_hotel_room_rates"
  ADD CONSTRAINT "reservation_hotel_room_rates_roomTypeId_fkey"
  FOREIGN KEY ("roomTypeId") REFERENCES "master_room_types"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;