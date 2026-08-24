-- CUSTOMER-001 review hardening: additive encrypted contact storage.
-- Existing masked-only contacts remain legacy rows until a real value is supplied again.

ALTER TABLE "customer_contacts"
  ADD COLUMN "encryptedValue" TEXT,
  ADD COLUMN "encryptionIv" CHAR(16),
  ADD COLUMN "encryptionAuthTag" CHAR(24),
  ADD COLUMN "encryptionKeyVersion" INTEGER,
  ADD COLUMN "valueFingerprint" CHAR(64);

ALTER TABLE "customer_contacts"
  ADD CONSTRAINT "customer_contacts_encryption_bundle_check"
  CHECK (
    (
      "encryptedValue" IS NULL
      AND "encryptionIv" IS NULL
      AND "encryptionAuthTag" IS NULL
      AND "encryptionKeyVersion" IS NULL
      AND "valueFingerprint" IS NULL
    )
    OR
    (
      "encryptedValue" IS NOT NULL
      AND char_length("encryptedValue") > 0
      AND "encryptionIv" IS NOT NULL
      AND char_length("encryptionIv") = 16
      AND "encryptionAuthTag" IS NOT NULL
      AND char_length("encryptionAuthTag") = 24
      AND "encryptionKeyVersion" IS NOT NULL
      AND "encryptionKeyVersion" > 0
      AND "valueFingerprint" IS NOT NULL
      AND "valueFingerprint" ~ '^[0-9a-f]{64}$'
    )
  );

CREATE UNIQUE INDEX "customer_contacts_customerId_type_valueFingerprint_key"
  ON "customer_contacts"("customerId", "type", "valueFingerprint");

CREATE INDEX "customer_contacts_type_valueFingerprint_customerId_idx"
  ON "customer_contacts"("type", "valueFingerprint", "customerId");
