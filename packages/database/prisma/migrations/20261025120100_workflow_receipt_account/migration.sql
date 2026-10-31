ALTER TABLE finance_accounting_workflows ADD COLUMN "receiptAccountId" uuid REFERENCES "FinanceSettlementAccount"(id) ON DELETE RESTRICT;
ALTER TABLE finance_accounting_workflows ADD CONSTRAINT workflow_receipt_kind CHECK ((kind='SUPPLIER_REFUND')=("receiptAccountId" IS NOT NULL));
CREATE FUNCTION scope_workflow_receipt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."receiptAccountId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "FinanceSettlementAccount" a WHERE a.id=NEW."receiptAccountId" AND a."branchId"=NEW."branchId" AND a."currencyCode"=NEW.currency) THEN RAISE EXCEPTION 'Workflow receipt account scope mismatch'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER workflow_receipt_scope BEFORE INSERT OR UPDATE ON finance_accounting_workflows FOR EACH ROW EXECUTE FUNCTION scope_workflow_receipt();
