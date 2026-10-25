CREATE TABLE finance_accounting_workflows (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "bookId" uuid NOT NULL REFERENCES accounting_books(id) ON DELETE RESTRICT,
 "branchId" uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
 "actorId" uuid NOT NULL REFERENCES iam_users(id) ON DELETE RESTRICT,
 kind varchar(32) NOT NULL CHECK(kind IN ('REVENUE','PAYROLL','PURCHASE_OUTCOME','SUPPLIER_REFUND','PURCHASE_WRITE_OFF','FX_SETTLEMENT')),
 "businessKey" varchar(240) NOT NULL UNIQUE,
 "contractId" uuid REFERENCES sales_contracts(id) ON DELETE RESTRICT,
 "hrRecordId" uuid REFERENCES hr_records(id) ON DELETE RESTRICT,
 "grossRecordId" uuid REFERENCES hr_records(id) ON DELETE RESTRICT,
 "sourceEventId" uuid REFERENCES finance_accounting_events(id) ON DELETE RESTRICT,
 amount numeric(24,4) NOT NULL CHECK(amount >= 0), currency varchar(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 "occurredAt" timestamptz(3) NOT NULL, reference varchar(160) NOT NULL CHECK(length(reference)>0),
 facts jsonb NOT NULL, cancelled boolean NOT NULL DEFAULT false,
 "journalId" uuid UNIQUE REFERENCES accounting_journals(id) ON DELETE RESTRICT,
 "createdAt" timestamptz(3) NOT NULL DEFAULT now(),
 CHECK ((kind='REVENUE' AND "contractId" IS NOT NULL AND "grossRecordId" IS NULL AND "hrRecordId" IS NULL AND "sourceEventId" IS NULL)
 OR (kind='PAYROLL' AND "hrRecordId" IS NOT NULL AND "grossRecordId" IS NOT NULL AND "contractId" IS NULL AND "sourceEventId" IS NULL)
 OR (kind IN ('PURCHASE_OUTCOME','SUPPLIER_REFUND','PURCHASE_WRITE_OFF','FX_SETTLEMENT') AND "sourceEventId" IS NOT NULL AND "grossRecordId" IS NULL AND "contractId" IS NULL AND "hrRecordId" IS NULL))
);
CREATE INDEX ON finance_accounting_workflows("branchId",kind,"occurredAt");
CREATE INDEX ON finance_accounting_workflows("sourceEventId",kind);
CREATE INDEX ON finance_accounting_workflows("contractId",kind);
CREATE INDEX ON finance_accounting_workflows("hrRecordId",kind);
CREATE FUNCTION protect_financial_workflow() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Financial workflow evidence cannot be deleted'; END IF;
 IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['journalId','cancelled']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['journalId','cancelled']) THEN
  RAISE EXCEPTION 'Financial workflow source is immutable';
 END IF;
 IF TG_OP='UPDATE' AND OLD."journalId" IS NOT NULL AND NEW."journalId" IS DISTINCT FROM OLD."journalId" THEN
  RAISE EXCEPTION 'Financial workflow journal link is immutable';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM accounting_books b WHERE b.id=NEW."bookId" AND b."branchId"=NEW."branchId")
 OR (NEW."contractId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sales_contracts s WHERE s.id=NEW."contractId" AND s.branch_id=NEW."branchId"))
 OR (NEW."hrRecordId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM hr_records h WHERE h.id=NEW."hrRecordId" AND h.branch_id=NEW."branchId"))
 OR (NEW."grossRecordId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM hr_records h WHERE h.id=NEW."grossRecordId" AND h.branch_id=NEW."branchId"))
 OR (NEW."sourceEventId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM finance_accounting_events e WHERE e.id=NEW."sourceEventId" AND e."branchId"=NEW."branchId"))
 OR (NEW."journalId" IS NOT NULL AND NOT EXISTS(SELECT 1 FROM accounting_journals j WHERE j.id=NEW."journalId" AND j."bookId"=NEW."bookId")) THEN
  RAISE EXCEPTION 'Financial workflow source scope mismatch';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER financial_workflow_integrity BEFORE INSERT OR UPDATE OR DELETE ON finance_accounting_workflows
FOR EACH ROW EXECUTE FUNCTION protect_financial_workflow();


CREATE UNIQUE INDEX workflow_active_revenue ON finance_accounting_workflows("branchId","contractId",currency) WHERE kind='REVENUE' AND NOT cancelled;
CREATE UNIQUE INDEX workflow_active_fx ON finance_accounting_workflows("sourceEventId") WHERE kind='FX_SETTLEMENT' AND NOT cancelled;
CREATE UNIQUE INDEX workflow_active_payroll ON finance_accounting_workflows("branchId",(facts->>'employeeId'),(facts->>'period'),currency) WHERE kind='PAYROLL' AND NOT cancelled;
