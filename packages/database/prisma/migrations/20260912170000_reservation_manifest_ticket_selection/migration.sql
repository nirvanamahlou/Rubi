ALTER TABLE "reservation_manifest_exports"
ADD COLUMN "flightKey" VARCHAR(64),
ADD COLUMN "templateCode" VARCHAR(80);

CREATE INDEX "reservation_manifest_exports_flightKey_createdAt_idx"
ON "reservation_manifest_exports"("flightKey", "createdAt");
