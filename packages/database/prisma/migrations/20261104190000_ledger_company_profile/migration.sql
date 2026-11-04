ALTER TABLE customers ADD COLUMN "ledgerCompanyCode" varchar(20), ADD COLUMN "ledgerCompanyEnvelope" text,
 ADD CONSTRAINT customers_ledger_company_shape CHECK (
 ("ledgerCompanyCode" IS NULL AND "ledgerCompanyEnvelope" IS NULL)
 OR (kind='ORGANIZATION' AND "organizationId" IS NOT NULL AND "ledgerCompanyCode" IS NOT NULL AND "ledgerCompanyCode" ~ '^[0-9]{1,20}$' AND "ledgerCompanyEnvelope" IS NOT NULL));
CREATE UNIQUE INDEX "customers_ownerBranchId_ledgerCompanyCode_key" ON customers("ownerBranchId","ledgerCompanyCode");
