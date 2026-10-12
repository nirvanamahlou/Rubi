CREATE TABLE accounting_statements (
  id uuid PRIMARY KEY,
  "bookId" uuid NOT NULL REFERENCES accounting_books(id) ON DELETE RESTRICT,
  "journalId" uuid NOT NULL,
  "periodId" uuid NOT NULL,
  "recipientId" uuid NOT NULL,
  level integer NOT NULL CHECK (level BETWEEN 4 AND 6),
  "currencyMode" boolean NOT NULL,
  number integer NOT NULL CHECK (number>0),
  "recipientNumber" integer NOT NULL CHECK ("recipientNumber">0),
  "documentDate" varchar(10) NOT NULL CHECK ("documentDate" ~ '^\d{4}-\d{2}-\d{2}$'),
  description varchar(2000) NOT NULL DEFAULT '',
  type varchar(8) NOT NULL CHECK (type IN ('DEBIT','CREDIT','BOTH')),
  status varchar(16) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED','SENT','CANCELLED')),
  "makerId" uuid NOT NULL,
  "lastModifierId" uuid,
  snapshot jsonb NOT NULL,
  notes jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1 CHECK (version>0),
  "createdAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("journalId","bookId") REFERENCES accounting_journals(id,"bookId") ON DELETE RESTRICT,
  FOREIGN KEY ("periodId","bookId") REFERENCES accounting_periods(id,"bookId") ON DELETE RESTRICT,
  FOREIGN KEY ("recipientId","bookId") REFERENCES accounting_details(id,"bookId") ON DELETE RESTRICT,
  UNIQUE ("bookId","periodId",number),
  UNIQUE ("bookId","periodId","recipientId","recipientNumber")
);
CREATE INDEX accounting_statements_journal_idx ON accounting_statements("bookId","journalId","createdAt");
CREATE FUNCTION accounting_statement_preserve_basis() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD."bookId",OLD."journalId",OLD."periodId",OLD."recipientId",OLD.level,OLD."currencyMode",OLD.number,OLD."recipientNumber",OLD.type,OLD."makerId",OLD.snapshot,OLD."createdAt") IS DISTINCT FROM ROW(NEW."bookId",NEW."journalId",NEW."periodId",NEW."recipientId",NEW.level,NEW."currencyMode",NEW.number,NEW."recipientNumber",NEW.type,NEW."makerId",NEW.snapshot,NEW."createdAt") THEN
    RAISE EXCEPTION 'ACCOUNTING_STATEMENT_BASIS_IMMUTABLE';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER accounting_statement_basis_guard BEFORE UPDATE ON accounting_statements FOR EACH ROW EXECUTE FUNCTION accounting_statement_preserve_basis();
