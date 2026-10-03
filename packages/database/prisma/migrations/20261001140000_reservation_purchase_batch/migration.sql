ALTER TABLE "ReservationServicePurchase"
  ADD COLUMN "batchId" UUID,
  ADD COLUMN "coveredServiceClientKeys" JSONB;

CREATE INDEX "ReservationServicePurchase_batchId_idx"
  ON "ReservationServicePurchase"("batchId");
