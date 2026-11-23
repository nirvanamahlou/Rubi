ALTER TABLE "FinanceSettlementAccount"
  ADD COLUMN "treasuryBookId" UUID,
  ADD COLUMN "bankAccountTypeId" UUID,
  ADD COLUMN "bankBranchId" UUID,
  ADD CONSTRAINT "FinanceSettlementAccount_bankAccountTypeId_treasuryBookId_fkey"
    FOREIGN KEY ("bankAccountTypeId","treasuryBookId") REFERENCES "accounting_configurations" ("id","bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FinanceSettlementAccount_bankBranchId_fkey"
    FOREIGN KEY ("bankBranchId") REFERENCES "master_bank_branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "treasury_bank_reference_set" CHECK (
    ("bankBranchId" IS NULL AND "bankAccountTypeId" IS NULL AND "treasuryBookId" IS NULL) OR
    ("bankBranchId" IS NOT NULL AND "bankAccountTypeId" IS NOT NULL AND "treasuryBookId" IS NOT NULL AND kind='BANK' AND NOT "isExternal" AND "branchId" IS NOT NULL AND "bankId" IS NOT NULL)
  );
CREATE INDEX "FinanceSettlementAccount_bankAccountTypeId_treasuryBookId_idx" ON "FinanceSettlementAccount" ("bankAccountTypeId","treasuryBookId");
CREATE INDEX "FinanceSettlementAccount_bankBranchId_idx" ON "FinanceSettlementAccount" ("bankBranchId");
