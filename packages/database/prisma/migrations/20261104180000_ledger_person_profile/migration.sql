ALTER TABLE customers ADD COLUMN "ledgerPersonCode" varchar(20),
  ADD COLUMN "ledgerPersonEnvelope" text,
  ADD CONSTRAINT customers_ledger_person_shape CHECK (
    ("ledgerPersonCode" IS NULL AND "ledgerPersonEnvelope" IS NULL)
    OR (kind = 'PERSON' AND "ledgerPersonCode" IS NOT NULL AND "ledgerPersonCode" ~ '^[0-9]{1,20}$' AND "ledgerPersonEnvelope" IS NOT NULL)
  );
CREATE UNIQUE INDEX "customers_ownerBranchId_ledgerPersonCode_key" ON customers("ownerBranchId","ledgerPersonCode");
