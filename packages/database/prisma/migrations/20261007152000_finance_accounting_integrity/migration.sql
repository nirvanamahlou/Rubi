CREATE FUNCTION accounting_guard_approved_fx() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status='APPROVED' THEN RAISE EXCEPTION 'approved accounting FX snapshot is immutable'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER accounting_fx_immutable BEFORE UPDATE OR DELETE ON accounting_fx_snapshots
FOR EACH ROW EXECUTE FUNCTION accounting_guard_approved_fx();
ALTER TABLE accounting_fx_snapshots ADD CONSTRAINT accounting_fx_integrity CHECK (
  rate>0 AND "validFrom"<"validTo" AND status IN ('DRAFT','APPROVED') AND
  (status='DRAFT' OR ("approverId" IS NOT NULL AND "makerId"<>"approverId"))
);
CREATE UNIQUE INDEX accounting_main_book_per_branch ON accounting_books ("branchId") WHERE "isMain"=true;
