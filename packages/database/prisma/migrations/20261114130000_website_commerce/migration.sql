CREATE TABLE "website_publications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "siteCode" VARCHAR(40) NOT NULL,
  "branchId" UUID NOT NULL, "kind" VARCHAR(20) NOT NULL, "resourceId" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false, "version" INTEGER NOT NULL DEFAULT 1,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "website_publications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "website_publications_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "website_publications_kind_check" CHECK ("kind" IN ('ticket','tour'))
);
CREATE UNIQUE INDEX "website_publications_siteCode_branchId_kind_resourceId_key" ON "website_publications"("siteCode","branchId","kind","resourceId");
CREATE INDEX "website_publications_siteCode_branchId_updatedAt_idx" ON "website_publications"("siteCode","branchId","updatedAt");
CREATE TABLE "website_orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "siteCode" VARCHAR(40) NOT NULL,
  "branchId" UUID NOT NULL, "externalId" VARCHAR(100) NOT NULL,
  "fingerprint" CHAR(64) NOT NULL, "contractId" UUID NOT NULL,
  "paymentFingerprint" CHAR(64), "paymentCommands" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "website_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "website_orders_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "website_orders_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "sales_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "website_orders_contractId_key" ON "website_orders"("contractId");
CREATE UNIQUE INDEX "website_orders_siteCode_branchId_externalId_key" ON "website_orders"("siteCode","branchId","externalId");
