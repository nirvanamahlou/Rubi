ALTER TABLE "master_banks"
  ADD COLUMN "institutionKind" VARCHAR(32),
  ADD COLUMN "publicRelationsPhone" VARCHAR(80),
  ADD COLUMN "website" VARCHAR(500),
  ADD COLUMN "description" VARCHAR(2000),
  ADD COLUMN "descriptionEn" VARCHAR(2000),
  ADD CONSTRAINT "master_banks_institution_kind_chk" CHECK ("institutionKind" IN ('BANK', 'FINANCIAL_INSTITUTION', 'QARD_HASAN_FUND'));

CREATE TABLE "finance_bank_account_profiles" (
  "accountId" UUID PRIMARY KEY REFERENCES "FinanceSettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "creditLimit" DECIMAL(24,4) CHECK ("creditLimit" >= 0),
  "reserveBalance" DECIMAL(24,4) CHECK ("reserveBalance" >= 0),
  "materiality" DECIMAL(24,4) CHECK ("materiality" >= 0),
  "backupAccountId" UUID REFERENCES "FinanceSettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "automaticTransfer" BOOLEAN NOT NULL DEFAULT FALSE,
  "transferMethodId" UUID REFERENCES "master_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "description" VARCHAR(2000),
  "descriptionEn" VARCHAR(2000),
  "notes" VARCHAR(4000),
  CONSTRAINT "bank_profile_no_self_backup" CHECK ("backupAccountId" <> "accountId"),
  CONSTRAINT "bank_profile_transfer_refs" CHECK (NOT "automaticTransfer" OR ("backupAccountId" IS NOT NULL AND "transferMethodId" IS NOT NULL))
);

CREATE INDEX "finance_bank_account_profiles_backupAccountId_idx" ON "finance_bank_account_profiles"("backupAccountId");
CREATE INDEX "finance_bank_account_profiles_transferMethodId_idx" ON "finance_bank_account_profiles"("transferMethodId");

CREATE TABLE "finance_bank_account_signers" (
  "accountId" UUID NOT NULL REFERENCES "finance_bank_account_profiles"("accountId") ON DELETE RESTRICT ON UPDATE CASCADE,
  "personId" UUID NOT NULL REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  PRIMARY KEY ("accountId", "personId")
);
CREATE INDEX "finance_bank_account_signers_personId_idx" ON "finance_bank_account_signers"("personId");
