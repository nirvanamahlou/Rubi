ALTER TABLE "master_suppliers"
  ADD COLUMN "address" VARCHAR(500),
  ADD COLUMN "primaryPhoneEncrypted" TEXT,
  ADD COLUMN "primaryPhoneEncryptionIv" VARCHAR(24),
  ADD COLUMN "primaryPhoneEncryptionAuthTag" VARCHAR(24),
  ADD COLUMN "primaryPhoneEncryptionKeyVersion" INTEGER,
  ADD COLUMN "primaryPhoneMasked" VARCHAR(80),
  ADD COLUMN "primaryPhoneFingerprint" CHAR(64);
