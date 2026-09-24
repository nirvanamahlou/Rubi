ALTER TABLE "reservation_hotel_group_rates"
  ADD COLUMN "currency" VARCHAR(3);

UPDATE "reservation_hotel_group_rates" AS rate
SET "currency" = batch."currency"
FROM "reservation_hotel_rate_batches" AS batch
WHERE batch."id" = rate."batchId";

ALTER TABLE "reservation_hotel_group_rates"
  ALTER COLUMN "currency" SET NOT NULL;
