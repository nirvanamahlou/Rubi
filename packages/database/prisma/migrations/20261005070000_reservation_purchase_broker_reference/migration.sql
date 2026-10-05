ALTER TABLE "ReservationServicePurchase"
  ALTER COLUMN "supplierOrganizationId" DROP NOT NULL,
  ADD COLUMN "supplierBrokerId" UUID;

ALTER TABLE "ReservationServicePurchase"
  ADD CONSTRAINT "ReservationServicePurchase_supplierBrokerId_fkey"
    FOREIGN KEY ("supplierBrokerId") REFERENCES "master_brokers"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ReservationServicePurchase_supplier_source_check"
    CHECK (num_nonnulls("supplierOrganizationId", "supplierBrokerId") = 1);

CREATE INDEX "ReservationServicePurchase_supplierBrokerId_createdAt_idx"
  ON "ReservationServicePurchase"("supplierBrokerId", "createdAt");
