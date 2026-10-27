-- Optional Sales-declared destination is separate from Finance-confirmed receipt.
ALTER TABLE "sales_contract_payment_entries"
  ADD COLUMN "destination_account_id" UUID,
  ADD COLUMN "destination_account_title" VARCHAR(250);

ALTER TABLE "sales_contract_payment_entries"
  ADD CONSTRAINT "sales_payment_destination_account_fk"
  FOREIGN KEY ("destination_account_id") REFERENCES "FinanceSettlementAccount"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
