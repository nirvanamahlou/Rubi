BEGIN;
CREATE TABLE sales_receipt_allocations (
  id UUID PRIMARY KEY,
  "sourcePaymentId" UUID NOT NULL REFERENCES sales_contract_payment_entries(id) ON DELETE RESTRICT,
  "targetContractId" UUID NOT NULL REFERENCES sales_contracts(id) ON DELETE RESTRICT,
  "branchId" UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  "actorId" UUID NOT NULL REFERENCES iam_users(id) ON DELETE RESTRICT,
  amount DECIMAL(24,4) NOT NULL CHECK (amount > 0),
  "currencyCode" VARCHAR(3) NOT NULL CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
  reason VARCHAR(500) NOT NULL CHECK (length(trim(reason)) >= 10),
  fingerprint CHAR(64) NOT NULL,
  "reversalOfId" UUID UNIQUE REFERENCES sales_receipt_allocations(id) ON DELETE RESTRICT,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX sales_receipt_allocations_source_idx ON sales_receipt_allocations("sourcePaymentId","createdAt");
CREATE INDEX sales_receipt_allocations_target_idx ON sales_receipt_allocations("targetContractId","createdAt");
CREATE INDEX sales_receipt_allocations_branch_idx ON sales_receipt_allocations("branchId","createdAt");
CREATE FUNCTION guard_sales_receipt_allocation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE original sales_receipt_allocations; valid_source BOOLEAN;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Receipt allocations are immutable; create a full reversal'; END IF;
  IF NEW."reversalOfId" IS NOT NULL THEN
    SELECT * INTO original FROM sales_receipt_allocations WHERE id=NEW."reversalOfId";
    IF NOT FOUND OR original."reversalOfId" IS NOT NULL OR
       ROW(NEW."sourcePaymentId",NEW."targetContractId",NEW."branchId",NEW.amount,NEW."currencyCode") IS DISTINCT FROM
       ROW(original."sourcePaymentId",original."targetContractId",original."branchId",original.amount,original."currencyCode")
    THEN RAISE EXCEPTION 'Allocation reversal must match its original allocation'; END IF;
  ELSE
    SELECT true INTO valid_source FROM sales_contract_payment_entries p
      JOIN sales_contracts s ON s.id=p.contract_id JOIN sales_contracts t ON t.id=NEW."targetContractId"
      WHERE p.id=NEW."sourcePaymentId" AND p.status='FINANCE_CONFIRMED' AND p.currency_code=NEW."currencyCode"
        AND s.branch_id=NEW."branchId" AND t.branch_id=NEW."branchId" AND s.customer_id=t.customer_id
        AND s.id<>t.id AND t.status<>'CANCELLED';
    IF valid_source IS NOT TRUE THEN RAISE EXCEPTION 'Receipt allocation source and target do not match'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sales_receipt_allocation_guard BEFORE INSERT OR UPDATE OR DELETE ON sales_receipt_allocations
FOR EACH ROW EXECUTE FUNCTION guard_sales_receipt_allocation();
ALTER TABLE finance_accounting_events ADD COLUMN "basisEventId" UUID REFERENCES finance_accounting_events(id) ON DELETE RESTRICT,
  ADD COLUMN "carryingAmount" DECIMAL(24,4), ADD COLUMN "carryingCurrency" VARCHAR(3);
CREATE INDEX financial_event_basis_idx ON finance_accounting_events("basisEventId");
ALTER TABLE finance_accounting_events ADD CONSTRAINT financial_allocation_basis CHECK (
  (kind IN ('RECEIPT_ALLOCATION','RECEIPT_ALLOCATION_REVERSAL') AND source='SALES' AND "basisEventId" IS NOT NULL
    AND "carryingAmount" IS NOT NULL AND "carryingCurrency" IS NOT NULL AND "carryingAmount" > 0 AND "carryingCurrency" ~ '^[A-Z]{3}$' AND "settlementAccountId" IS NULL)
  OR (kind NOT IN ('RECEIPT_ALLOCATION','RECEIPT_ALLOCATION_REVERSAL') AND "basisEventId" IS NULL AND "carryingAmount" IS NULL AND "carryingCurrency" IS NULL)
);
CREATE FUNCTION guard_financial_allocation_basis() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."basisEventId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM finance_accounting_events e JOIN accounting_journals j ON j.id=e."journalId"
      JOIN accounting_books b ON b.id=j."bookId"
    WHERE e.id=NEW."basisEventId" AND e.source='SALES' AND e.kind='CUSTOMER_RECEIPT'
      AND e."branchId"=NEW."branchId" AND e.currency=NEW.currency AND e."partyId" IS NOT DISTINCT FROM NEW."partyId"
      AND j.status='POSTED' AND b."baseCurrency"=NEW."carryingCurrency"
  ) THEN RAISE EXCEPTION 'Allocation requires its original posted receipt basis'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER financial_allocation_basis_guard BEFORE INSERT ON finance_accounting_events
FOR EACH ROW EXECUTE FUNCTION guard_financial_allocation_basis();

COMMIT;
