ALTER TYPE "FinanceSupplierPaymentStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_PAID' BEFORE 'PAID';

CREATE TABLE "FinanceSettlementAccount" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "branchId" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "kind" VARCHAR(24) NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  "bankId" UUID,
  "maskedIdentifier" VARCHAR(80),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceSettlementAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceSettlementAccount_kind_check" CHECK ("kind" IN ('BANK', 'CASH', 'POS', 'GATEWAY')),
  CONSTRAINT "FinanceSettlementAccount_currency_check" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
  CONSTRAINT "FinanceSettlementAccount_version_check" CHECK ("version" > 0),
  CONSTRAINT "FinanceSettlementAccount_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceSettlementAccount_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "master_banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceSettlementAccount_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FinanceSettlementAccount_branchId_title_currencyCode_key" ON "FinanceSettlementAccount"("branchId", "title", "currencyCode");
CREATE INDEX "FinanceSettlementAccount_branchId_isActive_title_idx" ON "FinanceSettlementAccount"("branchId", "isActive", "title");
CREATE INDEX "FinanceSettlementAccount_bankId_isActive_idx" ON "FinanceSettlementAccount"("bankId", "isActive");

ALTER TABLE "FinanceSupplierPaymentRevision" DROP CONSTRAINT "FinanceSupplierPaymentRevision_paid_fields_check";
ALTER TABLE "FinanceSupplierPaymentRevision"
  ADD COLUMN "accountId" UUID,
  ADD COLUMN "paymentMethodId" UUID,
  ADD COLUMN "paidAmount" DECIMAL(24,4),
  ADD COLUMN "exchangeRateToIrr" DECIMAL(24,8),
  ADD COLUMN "rialEquivalent" DECIMAL(24,4),
  ADD COLUMN "cumulativePaid" DECIMAL(24,4),
  ADD COLUMN "remainingAmount" DECIMAL(24,4);

UPDATE "FinanceSupplierPaymentRevision" revision
SET
  "paidAmount" = purchase."amount",
  "cumulativePaid" = purchase."amount",
  "remainingAmount" = 0,
  "exchangeRateToIrr" = CASE WHEN purchase."currencyCode" = 'IRR' THEN 1 ELSE NULL END,
  "rialEquivalent" = CASE WHEN purchase."currencyCode" = 'IRR' THEN purchase."amount" ELSE NULL END
FROM "ReservationServicePurchase" purchase
WHERE revision."purchaseId" = purchase."id" AND revision."status" = 'PAID';

ALTER TABLE "FinanceSupplierPaymentRevision"
  ADD CONSTRAINT "FinanceSupplierPaymentRevision_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceSettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FinanceSupplierPaymentRevision_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "master_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "FinanceSupplierPaymentRevision_amounts_check" CHECK (
    ("paidAmount" IS NULL OR "paidAmount" > 0) AND
    ("exchangeRateToIrr" IS NULL OR "exchangeRateToIrr" > 0) AND
    ("rialEquivalent" IS NULL OR "rialEquivalent" > 0) AND
    ("cumulativePaid" IS NULL OR "cumulativePaid" >= 0) AND
    ("remainingAmount" IS NULL OR "remainingAmount" >= 0)
  );

CREATE INDEX "FinanceSupplierPaymentRevision_accountId_transferAt_idx" ON "FinanceSupplierPaymentRevision"("accountId", "transferAt");
CREATE INDEX "FinanceSupplierPaymentRevision_paymentMethodId_transferAt_idx" ON "FinanceSupplierPaymentRevision"("paymentMethodId", "transferAt");

ALTER TABLE "sales_contract_payment_entries"
  ADD COLUMN "finance_decision_reason" VARCHAR(500),
  ADD COLUMN "finance_reviewed_by_user_id" UUID,
  ADD COLUMN "finance_reviewed_at" TIMESTAMPTZ(3),
  ADD CONSTRAINT "sales_contract_payment_entries_finance_reviewed_by_user_id_fkey" FOREIGN KEY ("finance_reviewed_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "sales_contract_payment_entries_finance_reviewed_by_user_id_finance_reviewed_at_idx" ON "sales_contract_payment_entries"("finance_reviewed_by_user_id", "finance_reviewed_at");
