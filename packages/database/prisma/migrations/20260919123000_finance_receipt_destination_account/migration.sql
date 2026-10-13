ALTER TABLE "sales_contract_payment_entries"
  ADD COLUMN "finance_receipt_account_id" UUID,
  ADD CONSTRAINT "sales_contract_payment_entries_finance_receipt_account_id_fkey"
    FOREIGN KEY ("finance_receipt_account_id")
    REFERENCES "FinanceSettlementAccount"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "sales_contract_payment_entries_finance_receipt_account_id_finance_confirmed_at_idx"
  ON "sales_contract_payment_entries"("finance_receipt_account_id", "finance_confirmed_at");

ALTER TABLE "sales_contract_payment_entries"
  ADD CONSTRAINT "sales_contract_payment_entries_confirmed_account_check"
  CHECK (
    "status" <> 'FINANCE_CONFIRMED'
    OR "finance_receipt_account_id" IS NOT NULL
  ) NOT VALID;

COMMENT ON COLUMN "sales_contract_payment_entries"."finance_receipt_account_id"
  IS 'Finance-owned destination account selected when a Sales receipt is confirmed.';