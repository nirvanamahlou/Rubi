ALTER TABLE "customers"
  ADD COLUMN "nationalIdEncrypted" TEXT,
  ADD COLUMN "nationalIdIv" CHAR(16),
  ADD COLUMN "nationalIdAuthTag" CHAR(24),
  ADD COLUMN "nationalIdKeyVersion" INTEGER,
  ADD COLUMN "nationalIdFingerprint" CHAR(64),
  ADD COLUMN "nationalIdMasked" VARCHAR(16);

CREATE UNIQUE INDEX "customers_nationalIdFingerprint_key"
  ON "customers"("nationalIdFingerprint");

ALTER TABLE "customers"
  ADD CONSTRAINT "customers_national_id_complete_check" CHECK (
    (
      "nationalIdEncrypted" IS NULL AND
      "nationalIdIv" IS NULL AND
      "nationalIdAuthTag" IS NULL AND
      "nationalIdKeyVersion" IS NULL AND
      "nationalIdFingerprint" IS NULL AND
      "nationalIdMasked" IS NULL
    ) OR (
      "nationalIdEncrypted" IS NOT NULL AND
      "nationalIdIv" IS NOT NULL AND
      "nationalIdAuthTag" IS NOT NULL AND
      "nationalIdKeyVersion" > 0 AND
      "nationalIdFingerprint" IS NOT NULL AND
      "nationalIdMasked" IS NOT NULL
    )
  );
