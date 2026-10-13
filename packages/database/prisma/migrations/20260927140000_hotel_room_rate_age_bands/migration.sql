-- Store accommodation capacity by the hotel age bands used by operations.
-- Existing aggregate child capacity remains untouched for legacy consumers.
ALTER TABLE "reservation_hotel_room_rates"
  ADD COLUMN "maxChildren2To6" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxChildren6To12" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "maxInfants" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "reservation_hotel_room_rates"
  ADD CONSTRAINT "reservation_hotel_room_rates_age_band_capacity_check"
  CHECK (
    "maxChildren2To6" BETWEEN 0 AND 20
    AND "maxChildren6To12" BETWEEN 0 AND 20
    AND "maxInfants" BETWEEN 0 AND 20
  );
