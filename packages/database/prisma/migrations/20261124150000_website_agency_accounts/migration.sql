CREATE TABLE "website_agency_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "site" VARCHAR(24) NOT NULL,
  "externalId" VARCHAR(100) NOT NULL,
  "branchId" UUID NOT NULL,
  "organizationId" UUID,
  "fingerprint" VARCHAR(64) NOT NULL,
  "legalName" VARCHAR(160) NOT NULL,
  "nationalId" VARCHAR(11),
  "registrationNumber" VARCHAR(80),
  "economicCode" VARCHAR(80),
  "tourismLicenseNumber" VARCHAR(80),
  "email" VARCHAR(254),
  "username" VARCHAR(254),
  "status" VARCHAR(12) NOT NULL,
  "siteApproved" BOOLEAN NOT NULL DEFAULT FALSE,
  "profile" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "website_agency_accounts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "website_agency_accounts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "website_agency_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "website_agency_accounts_valid_site" CHECK ("site" IN ('jahan-bastan', 'nss', 'ghestiroo')),
  CONSTRAINT "website_agency_accounts_state" CHECK ("status" IN ('REVIEW','LINKED') AND ("status" <> 'LINKED' OR "organizationId" IS NOT NULL AND "username" IS NOT NULL))
);
CREATE UNIQUE INDEX "website_agency_accounts_site_externalId_key" ON "website_agency_accounts"("site","externalId");
CREATE INDEX "website_agency_accounts_branchId_status_idx" ON "website_agency_accounts"("branchId","status");
CREATE INDEX "website_agency_accounts_organizationId_branchId_idx" ON "website_agency_accounts"("organizationId","branchId");
