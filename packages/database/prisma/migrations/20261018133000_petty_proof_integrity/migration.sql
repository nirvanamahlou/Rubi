CREATE UNIQUE INDEX petty_expense_unique_proof ON finance_operational_requests ("documentId")
WHERE kind='PETTY_CASH_EXPENSE' AND status NOT IN ('REJECTED','CANCELLED');
CREATE FUNCTION guard_petty_fund_reference() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."pettyFundId" IS NOT NULL AND NOT EXISTS (
  SELECT 1 FROM finance_operational_requests f WHERE f.id=NEW."pettyFundId" AND f.kind='PETTY_CASH_ADVANCE'
  AND f."branchId"=NEW."branchId" AND f."currencyCode"=NEW."currencyCode"
 ) THEN RAISE EXCEPTION 'Petty cash fund must match branch and currency'; END IF;
 IF TG_OP='UPDATE' AND OLD."pettyFundId" IS DISTINCT FROM NEW."pettyFundId" THEN RAISE EXCEPTION 'Petty fund association is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER petty_fund_reference_guard BEFORE INSERT OR UPDATE ON finance_operational_requests
FOR EACH ROW EXECUTE FUNCTION guard_petty_fund_reference();
