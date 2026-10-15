-- Preserve existing organization references; new rates may use registered brokers.
ALTER TABLE "reservation_hotel_group_rates"
  ALTER COLUMN "brokerId" DROP NOT NULL,
  ADD COLUMN "registeredBrokerId" UUID;

ALTER TABLE "reservation_hotel_group_rates"
  ADD CONSTRAINT "reservation_hotel_group_rates_registeredBrokerId_fkey"
  FOREIGN KEY ("registeredBrokerId") REFERENCES "master_brokers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "reservation_hotel_group_rates_broker_source_check"
  CHECK (("brokerId" IS NOT NULL) <> ("registeredBrokerId" IS NOT NULL));

CREATE UNIQUE INDEX "reservation_hotel_group_rates_batch_hotel_registered_key"
  ON "reservation_hotel_group_rates"("batchId", "hotelId", "registeredBrokerId");
