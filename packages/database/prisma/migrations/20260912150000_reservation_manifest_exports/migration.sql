CREATE TABLE "reservation_manifest_exports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "actorUserId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "fromDate" DATE NOT NULL,
  "toDate" DATE NOT NULL,
  "includePreviouslyExported" BOOLEAN NOT NULL DEFAULT false,
  "contractCount" INTEGER NOT NULL,
  "passengerCount" INTEGER NOT NULL,
  "skippedFinanceCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_manifest_exports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reservation_manifest_exports_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "reservation_manifest_exports_actorUserId_idempotencyKey_key"
  ON "reservation_manifest_exports"("actorUserId", "idempotencyKey");
CREATE INDEX "reservation_manifest_exports_actorUserId_createdAt_idx"
  ON "reservation_manifest_exports"("actorUserId", "createdAt");
CREATE INDEX "reservation_manifest_exports_fromDate_toDate_idx"
  ON "reservation_manifest_exports"("fromDate", "toDate");

CREATE TABLE "reservation_manifest_export_items" (
  "exportId" UUID NOT NULL,
  "intakeId" UUID NOT NULL,
  "contractId" UUID NOT NULL,
  "contractVersion" INTEGER NOT NULL,
  "outboundDepartureAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reservation_manifest_export_items_pkey" PRIMARY KEY ("exportId", "intakeId"),
  CONSTRAINT "reservation_manifest_export_items_exportId_fkey"
    FOREIGN KEY ("exportId") REFERENCES "reservation_manifest_exports"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "reservation_manifest_export_items_intakeId_fkey"
    FOREIGN KEY ("intakeId") REFERENCES "ReservationIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "reservation_manifest_export_items_intakeId_idx"
  ON "reservation_manifest_export_items"("intakeId");
CREATE INDEX "reservation_manifest_export_items_contractId_contractVersion_idx"
  ON "reservation_manifest_export_items"("contractId", "contractVersion");
