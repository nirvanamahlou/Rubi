ALTER TABLE "sales_contract_services" ADD COLUMN "pricing" JSONB;
ALTER TABLE "ReservationIntake" ADD COLUMN "purchaseVersion" INTEGER NOT NULL DEFAULT 0;
CREATE TABLE "ReservationHotelPurchase" (
  "id" UUID NOT NULL,
  "intakeId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "amount" DECIMAL(24,4) NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  "actorUserId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationHotelPurchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReservationHotelPurchase_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ReservationIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReservationHotelPurchase_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "ReservationHotelPurchase_version_check" CHECK ("version" > 0),
  CONSTRAINT "ReservationHotelPurchase_currency_check" CHECK ("currencyCode" ~ '^[A-Z]{3}$')
);
CREATE UNIQUE INDEX "ReservationHotelPurchase_intakeId_version_key" ON "ReservationHotelPurchase"("intakeId","version");
CREATE UNIQUE INDEX "ReservationHotelPurchase_actorUserId_idempotencyKey_key" ON "ReservationHotelPurchase"("actorUserId","idempotencyKey");

