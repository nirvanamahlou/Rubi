-- AGENCY-B2B-INTEGRATIONS-001: additive Master Data address and B2B terms.

CREATE TYPE "AgencyOperationalStatus" AS ENUM ('ACTIVE', 'UNDER_REVIEW', 'SUSPENDED', 'ENDED');
CREATE TYPE "B2bAgreementStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'TERMINATED');
CREATE TYPE "B2bAgreedRateKind" AS ENUM ('FIXED_AMOUNT', 'DISCOUNT_PERCENT', 'COMMISSION_PERCENT');

CREATE UNIQUE INDEX "master_cities_id_countryId_key"
ON "master_cities"("id", "countryId");

CREATE TABLE "master_organization_addresses" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "countryId" UUID NOT NULL,
  "cityId" UUID NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "postalCode" VARCHAR(24),
  "addressLine" VARCHAR(500) NOT NULL,
  "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_organization_addresses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_organization_addresses_version_check" CHECK ("version" > 0),
  CONSTRAINT "master_organization_addresses_display_order_check" CHECK ("displayOrder" >= 0),
  CONSTRAINT "master_organization_addresses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "master_organization_addresses_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "master_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "master_organization_addresses_city_country_fkey" FOREIGN KEY ("cityId", "countryId") REFERENCES "master_cities"("id", "countryId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "master_organization_addresses_organization_primary_active_idx"
ON "master_organization_addresses"("organizationId", "isPrimary", "isActive", "displayOrder");
CREATE INDEX "master_organization_addresses_country_city_idx"
ON "master_organization_addresses"("countryId", "cityId");
CREATE UNIQUE INDEX "master_organization_addresses_one_primary_active_key"
ON "master_organization_addresses"("organizationId")
WHERE "isPrimary" = true AND "isActive" = true;

CREATE TABLE "b2b_agency_profiles" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "accountManagerUserId" UUID,
  "status" "AgencyOperationalStatus" NOT NULL DEFAULT 'ACTIVE',
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "b2b_agency_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "b2b_agency_profiles_version_check" CHECK ("version" > 0),
  CONSTRAINT "b2b_agency_profiles_display_order_check" CHECK ("displayOrder" >= 0),
  CONSTRAINT "b2b_agency_profiles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "b2b_agency_profiles_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "b2b_agency_profiles_accountManagerUserId_fkey" FOREIGN KEY ("accountManagerUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "b2b_agency_profiles_organization_branch_key"
ON "b2b_agency_profiles"("organizationId", "branchId");
CREATE INDEX "b2b_agency_profiles_branch_status_active_idx"
ON "b2b_agency_profiles"("branchId", "status", "isActive");
CREATE INDEX "b2b_agency_profiles_account_manager_active_idx"
ON "b2b_agency_profiles"("accountManagerUserId", "isActive");

CREATE TABLE "b2b_agency_agreements" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "documentReference" UUID,
  "startsAt" DATE NOT NULL,
  "endsAt" DATE,
  "status" "B2bAgreementStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" VARCHAR(500),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "b2b_agency_agreements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "b2b_agency_agreements_date_check" CHECK ("endsAt" IS NULL OR "endsAt" >= "startsAt"),
  CONSTRAINT "b2b_agency_agreements_version_check" CHECK ("version" > 0),
  CONSTRAINT "b2b_agency_agreements_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "b2b_agency_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "b2b_agency_agreements_code_key" ON "b2b_agency_agreements"("code");
CREATE INDEX "b2b_agency_agreements_profile_status_dates_idx"
ON "b2b_agency_agreements"("profileId", "status", "startsAt", "endsAt");

CREATE TABLE "b2b_agency_credit_policies" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "creditLimit" DECIMAL(20,2) NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "expiresAt" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "b2b_agency_credit_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "b2b_agency_credit_policies_limit_check" CHECK ("creditLimit" >= 0),
  CONSTRAINT "b2b_agency_credit_policies_currency_check" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
  CONSTRAINT "b2b_agency_credit_policies_date_check" CHECK ("expiresAt" IS NULL OR "expiresAt" >= "effectiveFrom"),
  CONSTRAINT "b2b_agency_credit_policies_version_check" CHECK ("version" > 0),
  CONSTRAINT "b2b_agency_credit_policies_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "b2b_agency_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "b2b_agency_credit_policies_profile_key"
ON "b2b_agency_credit_policies"("profileId");
CREATE INDEX "b2b_agency_credit_policies_currency_active_expiry_idx"
ON "b2b_agency_credit_policies"("currencyCode", "isActive", "expiresAt");

CREATE TABLE "b2b_agency_agreed_rates" (
  "id" UUID NOT NULL,
  "profileId" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "serviceReference" VARCHAR(120) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "kind" "B2bAgreedRateKind" NOT NULL,
  "value" DECIMAL(20,4) NOT NULL,
  "currencyCode" CHAR(3),
  "validFrom" DATE NOT NULL,
  "validTo" DATE,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "b2b_agency_agreed_rates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "b2b_agency_agreed_rates_value_check" CHECK ("value" >= 0),
  CONSTRAINT "b2b_agency_agreed_rates_percent_check" CHECK ("kind" = 'FIXED_AMOUNT' OR "value" <= 100),
  CONSTRAINT "b2b_agency_agreed_rates_currency_check" CHECK (("kind" = 'FIXED_AMOUNT' AND "currencyCode" ~ '^[A-Z]{3}$') OR ("kind" <> 'FIXED_AMOUNT' AND "currencyCode" IS NULL)),
  CONSTRAINT "b2b_agency_agreed_rates_date_check" CHECK ("validTo" IS NULL OR "validTo" >= "validFrom"),
  CONSTRAINT "b2b_agency_agreed_rates_version_check" CHECK ("version" > 0),
  CONSTRAINT "b2b_agency_agreed_rates_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "b2b_agency_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "b2b_agency_agreed_rates_code_key" ON "b2b_agency_agreed_rates"("code");
CREATE INDEX "b2b_agency_agreed_rates_profile_active_dates_idx"
ON "b2b_agency_agreed_rates"("profileId", "isActive", "validFrom", "validTo");
CREATE INDEX "b2b_agency_agreed_rates_service_active_idx"
ON "b2b_agency_agreed_rates"("serviceReference", "isActive");

CREATE TABLE "b2b_audit_events" (
  "id" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "action" VARCHAR(120) NOT NULL,
  "entityType" VARCHAR(80) NOT NULL,
  "entityId" UUID NOT NULL,
  "beforeSnapshot" JSONB,
  "afterSnapshot" JSONB,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "b2b_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "b2b_audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "b2b_audit_events_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "b2b_audit_events_entity_occurred_idx"
ON "b2b_audit_events"("entityType", "entityId", "occurredAt");
CREATE INDEX "b2b_audit_events_actor_occurred_idx"
ON "b2b_audit_events"("actorUserId", "occurredAt");
CREATE INDEX "b2b_audit_events_branch_occurred_idx"
ON "b2b_audit_events"("branchId", "occurredAt");
