CREATE TABLE accounting_journal_transfers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 "sourceBookId" uuid NOT NULL REFERENCES accounting_books(id) ON DELETE RESTRICT,
 "sourceJournalId" uuid NOT NULL,
 "targetBookId" uuid NOT NULL REFERENCES accounting_books(id) ON DELETE RESTRICT,
 "targetJournalId" uuid NOT NULL,
 "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY ("sourceJournalId","sourceBookId") REFERENCES accounting_journals(id,"bookId") ON DELETE RESTRICT,
 FOREIGN KEY ("targetJournalId","targetBookId") REFERENCES accounting_journals(id,"bookId") ON DELETE RESTRICT,
 UNIQUE ("sourceJournalId","targetBookId"),
 CHECK ("sourceBookId"<>"targetBookId")
);
CREATE INDEX "accounting_journal_transfers_sourceBookId_idx" ON accounting_journal_transfers("sourceBookId");
CREATE INDEX "accounting_journal_transfers_targetJournalId_idx" ON accounting_journal_transfers("targetJournalId");
CREATE FUNCTION accounting_transfer_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Accounting transfer membership is immutable'; END IF;
 IF NOT EXISTS (SELECT 1 FROM accounting_journals s JOIN accounting_books b ON b.id=s."bookId" WHERE s.id=NEW."sourceJournalId" AND s."bookId"=NEW."sourceBookId" AND s.status IN ('APPROVED','POSTED') AND b."isMain"=true) THEN RAISE EXCEPTION 'Transfer source must be an approved main-ledger journal'; END IF;
 IF NOT EXISTS (SELECT 1 FROM accounting_journals t JOIN accounting_books b ON b.id=t."bookId" WHERE t.id=NEW."targetJournalId" AND t."bookId"=NEW."targetBookId" AND t.status='DRAFT' AND b."isMain"=false) THEN RAISE EXCEPTION 'Transfer target must be a temporary subsidiary-ledger journal'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER accounting_transfer_membership_guard BEFORE INSERT OR UPDATE OR DELETE ON accounting_journal_transfers FOR EACH ROW EXECUTE FUNCTION accounting_transfer_guard();
