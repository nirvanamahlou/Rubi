-- Additive: historic room-rate versions and their references remain unchanged.
ALTER TABLE "reservation_hotel_room_rates" ADD COLUMN "occupancyRates" JSONB;
ALTER TABLE "reservation_hotel_room_rates" ADD CONSTRAINT "reservation_hotel_room_rates_occupancy_array"
CHECK ("occupancyRates" IS NULL OR jsonb_typeof("occupancyRates") = 'array');
