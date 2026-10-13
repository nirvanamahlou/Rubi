-- Optional passenger passport number, encrypted at the Customers boundary.
ALTER TABLE "customers"
  ADD COLUMN "passportNumberEncrypted" TEXT,
  ADD COLUMN "passportNumberIv" CHAR(16),
  ADD COLUMN "passportNumberAuthTag" CHAR(24),
  ADD COLUMN "passportNumberKeyVersion" INTEGER,
  ADD COLUMN "passportNumberFingerprint" CHAR(64),
  ADD COLUMN "passportNumberMasked" VARCHAR(24);

CREATE UNIQUE INDEX "customers_passportNumberFingerprint_key"
  ON "customers"("passportNumberFingerprint");

ALTER TABLE "customers" ADD CONSTRAINT "customers_passport_number_encryption_complete"
  CHECK (
    (
      "passportNumberEncrypted" IS NULL AND
      "passportNumberIv" IS NULL AND
      "passportNumberAuthTag" IS NULL AND
      "passportNumberKeyVersion" IS NULL AND
      "passportNumberFingerprint" IS NULL AND
      "passportNumberMasked" IS NULL
    ) OR (
      "passportNumberEncrypted" IS NOT NULL AND
      "passportNumberIv" IS NOT NULL AND
      "passportNumberAuthTag" IS NOT NULL AND
      "passportNumberKeyVersion" > 0 AND
      "passportNumberFingerprint" IS NOT NULL AND
      "passportNumberMasked" IS NOT NULL
    )
  );
