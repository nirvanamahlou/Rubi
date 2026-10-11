ALTER TABLE "master_organizations"
  ADD COLUMN "registrationNumber" VARCHAR(80),
  ADD COLUMN "economicCode" VARCHAR(80),
  ADD COLUMN "tourismLicenseNumber" VARCHAR(80);

CREATE UNIQUE INDEX "master_organizations_registrationNumber_key"
  ON "master_organizations"("registrationNumber");
CREATE UNIQUE INDEX "master_organizations_economicCode_key"
  ON "master_organizations"("economicCode");
CREATE UNIQUE INDEX "master_organizations_tourismLicenseNumber_key"
  ON "master_organizations"("tourismLicenseNumber");

ALTER TABLE "master_organization_contacts"
  ADD COLUMN "nationalIdEncrypted" TEXT,
  ADD COLUMN "nationalIdEncryptionIv" VARCHAR(24),
  ADD COLUMN "nationalIdEncryptionAuthTag" VARCHAR(24),
  ADD COLUMN "nationalIdEncryptionKeyVersion" INTEGER,
  ADD COLUMN "nationalIdMasked" VARCHAR(16),
  ADD COLUMN "nationalIdFingerprint" CHAR(64);

CREATE UNIQUE INDEX "master_organization_contacts_organizationId_nationalIdFingerprint_key"
  ON "master_organization_contacts"("organizationId", "nationalIdFingerprint");
