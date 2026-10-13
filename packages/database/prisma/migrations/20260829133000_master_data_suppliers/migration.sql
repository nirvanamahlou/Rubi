CREATE TYPE "MasterCollaborationStatus" AS ENUM (
  'ACTIVE',
  'UNDER_REVIEW',
  'PURCHASE_SUSPENDED',
  'ENDED'
);

CREATE TYPE "MasterOrganizationContactChannel" AS ENUM (
  'PHONE',
  'WHATSAPP',
  'EMAIL',
  'TELEGRAM',
  'OTHER'
);

ALTER TABLE "master_brokers"
  ADD COLUMN "countryId" UUID,
  ADD COLUMN "cityId" UUID,
  ADD COLUMN "collaborationStatus" "MasterCollaborationStatus" NOT NULL DEFAULT 'UNDER_REVIEW';

CREATE TABLE "master_suppliers" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "countryId" UUID,
  "cityId" UUID,
  "code" VARCHAR(32) NOT NULL,
  "externalProviderReference" VARCHAR(120),
  "collaborationStatus" "MasterCollaborationStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_suppliers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_suppliers_provider_ref_nonblank_check"
    CHECK ("externalProviderReference" IS NULL OR btrim("externalProviderReference") <> '')
);

CREATE TABLE "master_travel_services" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_travel_services_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "master_supplier_services" (
  "supplierId" UUID NOT NULL,
  "serviceId" UUID NOT NULL,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId" UUID NOT NULL,
  CONSTRAINT "master_supplier_services_pkey" PRIMARY KEY ("supplierId", "serviceId")
);

CREATE TABLE "master_broker_services" (
  "brokerId" UUID NOT NULL,
  "serviceId" UUID NOT NULL,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assignedByUserId" UUID NOT NULL,
  CONSTRAINT "master_broker_services_pkey" PRIMARY KEY ("brokerId", "serviceId")
);

CREATE TABLE "master_organization_contacts" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "fullName" VARCHAR(160) NOT NULL,
  "jobTitle" VARCHAR(160),
  "preferredChannel" "MasterOrganizationContactChannel" NOT NULL DEFAULT 'PHONE',
  "hasWhatsapp" BOOLEAN NOT NULL DEFAULT false,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "phoneEncrypted" TEXT,
  "phoneEncryptionIv" VARCHAR(24),
  "phoneEncryptionAuthTag" VARCHAR(24),
  "phoneEncryptionKeyVersion" INTEGER,
  "phoneMasked" VARCHAR(80),
  "phoneFingerprint" CHAR(64),
  "emailEncrypted" TEXT,
  "emailEncryptionIv" VARCHAR(24),
  "emailEncryptionAuthTag" VARCHAR(24),
  "emailEncryptionKeyVersion" INTEGER,
  "emailMasked" VARCHAR(320),
  "emailFingerprint" CHAR(64),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_organization_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_organization_contacts_value_check"
    CHECK ("phoneMasked" IS NOT NULL OR "emailMasked" IS NOT NULL),
  CONSTRAINT "master_organization_contacts_phone_crypto_check" CHECK (
    ("phoneEncrypted" IS NULL AND "phoneEncryptionIv" IS NULL AND "phoneEncryptionAuthTag" IS NULL AND "phoneEncryptionKeyVersion" IS NULL AND "phoneMasked" IS NULL AND "phoneFingerprint" IS NULL)
    OR
    ("phoneEncrypted" IS NOT NULL AND "phoneEncryptionIv" IS NOT NULL AND "phoneEncryptionAuthTag" IS NOT NULL AND "phoneEncryptionKeyVersion" IS NOT NULL AND "phoneMasked" IS NOT NULL AND "phoneFingerprint" IS NOT NULL)
  ),
  CONSTRAINT "master_organization_contacts_email_crypto_check" CHECK (
    ("emailEncrypted" IS NULL AND "emailEncryptionIv" IS NULL AND "emailEncryptionAuthTag" IS NULL AND "emailEncryptionKeyVersion" IS NULL AND "emailMasked" IS NULL AND "emailFingerprint" IS NULL)
    OR
    ("emailEncrypted" IS NOT NULL AND "emailEncryptionIv" IS NOT NULL AND "emailEncryptionAuthTag" IS NOT NULL AND "emailEncryptionKeyVersion" IS NOT NULL AND "emailMasked" IS NOT NULL AND "emailFingerprint" IS NOT NULL)
  )
);

CREATE UNIQUE INDEX "master_suppliers_organizationId_key" ON "master_suppliers"("organizationId");
CREATE UNIQUE INDEX "master_suppliers_code_key" ON "master_suppliers"("code");
CREATE INDEX "master_suppliers_countryId_cityId_isActive_idx" ON "master_suppliers"("countryId", "cityId", "isActive");
CREATE INDEX "master_suppliers_collaborationStatus_isActive_idx" ON "master_suppliers"("collaborationStatus", "isActive");
CREATE INDEX "master_suppliers_externalProviderReference_idx" ON "master_suppliers"("externalProviderReference");

CREATE UNIQUE INDEX "master_travel_services_code_key" ON "master_travel_services"("code");
CREATE INDEX "master_travel_services_isActive_name_idx" ON "master_travel_services"("isActive", "name");

CREATE INDEX "master_supplier_services_serviceId_idx" ON "master_supplier_services"("serviceId");
CREATE INDEX "master_broker_services_serviceId_idx" ON "master_broker_services"("serviceId");

CREATE UNIQUE INDEX "master_organization_contacts_code_key" ON "master_organization_contacts"("code");
CREATE UNIQUE INDEX "master_organization_contacts_organizationId_phoneFingerprint_key" ON "master_organization_contacts"("organizationId", "phoneFingerprint");
CREATE UNIQUE INDEX "master_organization_contacts_organizationId_emailFingerprint_key" ON "master_organization_contacts"("organizationId", "emailFingerprint");
CREATE INDEX "master_organization_contacts_organizationId_isActive_fullName_idx" ON "master_organization_contacts"("organizationId", "isActive", "fullName");
CREATE INDEX "master_organization_contacts_hasWhatsapp_isActive_idx" ON "master_organization_contacts"("hasWhatsapp", "isActive");

CREATE INDEX "master_brokers_countryId_cityId_isActive_idx" ON "master_brokers"("countryId", "cityId", "isActive");
CREATE INDEX "master_brokers_collaborationStatus_isActive_idx" ON "master_brokers"("collaborationStatus", "isActive");

ALTER TABLE "master_suppliers"
  ADD CONSTRAINT "master_suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_suppliers_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "master_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_suppliers_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_supplier_services"
  ADD CONSTRAINT "master_supplier_services_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "master_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_supplier_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "master_travel_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_broker_services"
  ADD CONSTRAINT "master_broker_services_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "master_brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_broker_services_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "master_travel_services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_organization_contacts"
  ADD CONSTRAINT "master_organization_contacts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "master_brokers"
  ADD CONSTRAINT "master_brokers_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "master_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "master_brokers_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
