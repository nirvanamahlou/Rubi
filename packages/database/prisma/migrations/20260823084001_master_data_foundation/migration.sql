-- CreateEnum
CREATE TYPE "MasterOrganizationRoleCode" AS ENUM ('AGENCY', 'CORPORATE_CUSTOMER', 'SUPPLIER', 'AIRLINE', 'HOTEL_PROVIDER', 'INSURANCE_PROVIDER', 'BUS_PROVIDER', 'TOUR_OPERATOR', 'BROKER');

-- CreateEnum
CREATE TYPE "MasterDataExportFormat" AS ENUM ('XLSX', 'PDF');

-- CreateEnum
CREATE TYPE "MasterDataExportStatus" AS ENUM ('AWAITING_DOCUMENTS_WORKER', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "master_countries" (
    "id" UUID NOT NULL,
    "code" CHAR(2) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "englishName" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_cities" (
    "id" UUID NOT NULL,
    "countryId" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_currencies" (
    "id" UUID NOT NULL,
    "code" CHAR(3) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "symbol" VARCHAR(16),
    "decimalDigits" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_draft_exchange_rates" (
    "id" UUID NOT NULL,
    "fromCurrencyId" UUID NOT NULL,
    "toCurrencyId" UUID NOT NULL,
    "rate" DECIMAL(24,10) NOT NULL,
    "source" VARCHAR(160) NOT NULL,
    "observedAt" TIMESTAMPTZ(3) NOT NULL,
    "isAuthoritative" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_draft_exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_banks" (
    "id" UUID NOT NULL,
    "countryId" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_organizations" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "legalName" VARCHAR(200) NOT NULL,
    "displayName" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_organization_roles" (
    "organizationId" UUID NOT NULL,
    "roleCode" "MasterOrganizationRoleCode" NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedByUserId" UUID NOT NULL,

    CONSTRAINT "master_organization_roles_pkey" PRIMARY KEY ("organizationId","roleCode")
);

-- CreateTable
CREATE TABLE "master_insurers" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_insurers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_airlines" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" CHAR(2) NOT NULL,
    "icaoCode" CHAR(3),
    "name" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_airlines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_hotels" (
    "id" UUID NOT NULL,
    "cityId" UUID NOT NULL,
    "organizationId" UUID,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "starRating" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_brokers" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_brokers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_leaders" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "languages" TEXT[],
    "expertise" VARCHAR(300),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_leaders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_acquaintance_methods" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" UUID NOT NULL,
    "updatedByUserId" UUID NOT NULL,
    "deactivatedByUserId" UUID,
    "deactivatedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_acquaintance_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_audit_events" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "actorBranchId" UUID NOT NULL,
    "action" VARCHAR(120) NOT NULL,
    "resource" VARCHAR(80) NOT NULL,
    "entityId" UUID,
    "outcome" "AuditOutcome" NOT NULL,
    "beforeSnapshot" JSONB,
    "afterSnapshot" JSONB,
    "traceId" VARCHAR(120),
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_export_requests" (
    "id" UUID NOT NULL,
    "resource" VARCHAR(80) NOT NULL,
    "format" "MasterDataExportFormat" NOT NULL,
    "filterSnapshot" JSONB NOT NULL,
    "columns" TEXT[],
    "permissionSnapshot" TEXT[],
    "actorUserId" UUID NOT NULL,
    "actorBranchId" UUID NOT NULL,
    "locale" VARCHAR(20) NOT NULL,
    "timezone" VARCHAR(80) NOT NULL,
    "status" "MasterDataExportStatus" NOT NULL DEFAULT 'AWAITING_DOCUMENTS_WORKER',
    "artifactId" UUID,
    "failureReason" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "master_export_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_countries_code_key" ON "master_countries"("code");

-- CreateIndex
CREATE INDEX "master_countries_isActive_name_idx" ON "master_countries"("isActive", "name");

-- CreateIndex
CREATE INDEX "master_cities_countryId_isActive_name_idx" ON "master_cities"("countryId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "master_cities_countryId_code_key" ON "master_cities"("countryId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "master_currencies_code_key" ON "master_currencies"("code");

-- CreateIndex
CREATE INDEX "master_currencies_isActive_name_idx" ON "master_currencies"("isActive", "name");

-- CreateIndex
CREATE INDEX "master_draft_exchange_rates_fromCurrencyId_toCurrencyId_obs_idx" ON "master_draft_exchange_rates"("fromCurrencyId", "toCurrencyId", "observedAt");

-- CreateIndex
CREATE INDEX "master_draft_exchange_rates_isActive_observedAt_idx" ON "master_draft_exchange_rates"("isActive", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "master_banks_code_key" ON "master_banks"("code");

-- CreateIndex
CREATE INDEX "master_banks_countryId_isActive_name_idx" ON "master_banks"("countryId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "master_organizations_code_key" ON "master_organizations"("code");

-- CreateIndex
CREATE INDEX "master_organizations_isActive_displayName_idx" ON "master_organizations"("isActive", "displayName");

-- CreateIndex
CREATE INDEX "master_organization_roles_roleCode_idx" ON "master_organization_roles"("roleCode");

-- CreateIndex
CREATE UNIQUE INDEX "master_insurers_organizationId_key" ON "master_insurers"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "master_insurers_code_key" ON "master_insurers"("code");

-- CreateIndex
CREATE INDEX "master_insurers_isActive_name_idx" ON "master_insurers"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "master_airlines_organizationId_key" ON "master_airlines"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "master_airlines_code_key" ON "master_airlines"("code");

-- CreateIndex
CREATE UNIQUE INDEX "master_airlines_icaoCode_key" ON "master_airlines"("icaoCode");

-- CreateIndex
CREATE INDEX "master_airlines_isActive_name_idx" ON "master_airlines"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "master_hotels_organizationId_key" ON "master_hotels"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "master_hotels_code_key" ON "master_hotels"("code");

-- CreateIndex
CREATE INDEX "master_hotels_cityId_isActive_name_idx" ON "master_hotels"("cityId", "isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "master_brokers_organizationId_key" ON "master_brokers"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "master_brokers_code_key" ON "master_brokers"("code");

-- CreateIndex
CREATE INDEX "master_brokers_isActive_name_idx" ON "master_brokers"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "master_leaders_code_key" ON "master_leaders"("code");

-- CreateIndex
CREATE INDEX "master_leaders_isActive_name_idx" ON "master_leaders"("isActive", "name");

-- CreateIndex
CREATE UNIQUE INDEX "master_acquaintance_methods_code_key" ON "master_acquaintance_methods"("code");

-- CreateIndex
CREATE INDEX "master_acquaintance_methods_isActive_name_idx" ON "master_acquaintance_methods"("isActive", "name");

-- CreateIndex
CREATE INDEX "master_audit_events_resource_entityId_occurredAt_idx" ON "master_audit_events"("resource", "entityId", "occurredAt");

-- CreateIndex
CREATE INDEX "master_audit_events_actorUserId_occurredAt_idx" ON "master_audit_events"("actorUserId", "occurredAt");

-- CreateIndex
CREATE INDEX "master_export_requests_actorUserId_createdAt_idx" ON "master_export_requests"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "master_export_requests_status_createdAt_idx" ON "master_export_requests"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "master_cities" ADD CONSTRAINT "master_cities_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "master_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_draft_exchange_rates" ADD CONSTRAINT "master_draft_exchange_rates_fromCurrencyId_fkey" FOREIGN KEY ("fromCurrencyId") REFERENCES "master_currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_draft_exchange_rates" ADD CONSTRAINT "master_draft_exchange_rates_toCurrencyId_fkey" FOREIGN KEY ("toCurrencyId") REFERENCES "master_currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_banks" ADD CONSTRAINT "master_banks_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "master_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_organization_roles" ADD CONSTRAINT "master_organization_roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_insurers" ADD CONSTRAINT "master_insurers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_airlines" ADD CONSTRAINT "master_airlines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_hotels" ADD CONSTRAINT "master_hotels_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_hotels" ADD CONSTRAINT "master_hotels_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_brokers" ADD CONSTRAINT "master_brokers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
