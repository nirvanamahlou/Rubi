ALTER TABLE "FinanceSettlementAccount"
  ADD COLUMN "isExternal" BOOLEAN NOT NULL DEFAULT false,
  ALTER COLUMN "branchId" DROP NOT NULL,
  ALTER COLUMN "currencyCode" DROP NOT NULL;
ALTER TABLE "FinanceSettlementAccount" ADD CONSTRAINT "FinanceSettlementAccount_external_scope_check"
  CHECK (("isExternal" AND "kind" = 'BANK' AND "bankId" IS NOT NULL) OR
    (NOT "isExternal" AND "branchId" IS NOT NULL AND "currencyCode" IS NOT NULL));
