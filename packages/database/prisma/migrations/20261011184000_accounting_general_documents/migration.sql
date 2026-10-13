BEGIN;
CREATE TABLE accounting_general_documents (
  id UUID PRIMARY KEY, "bookId" UUID NOT NULL REFERENCES accounting_books(id) ON DELETE RESTRICT,
  "periodId" UUID NOT NULL, number INTEGER NOT NULL CHECK(number>0),
  "documentDate" VARCHAR(10) NOT NULL, method VARCHAR(16) NOT NULL CHECK(method IN('NONE','DAILY','MONTHLY')),
  "makerId" UUID NOT NULL REFERENCES iam_users(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  FOREIGN KEY("periodId","bookId") REFERENCES accounting_periods(id,"bookId") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "accounting_general_documents_id_bookId_key" ON accounting_general_documents(id,"bookId");
CREATE UNIQUE INDEX "accounting_general_documents_bookId_periodId_number_key" ON accounting_general_documents("bookId","periodId",number);
CREATE INDEX "accounting_general_documents_bookId_periodId_documentDate_idx" ON accounting_general_documents("bookId","periodId","documentDate");
CREATE TABLE accounting_general_document_members (
  "journalId" UUID PRIMARY KEY, "bookId" UUID NOT NULL, "documentId" UUID NOT NULL,
  FOREIGN KEY("journalId","bookId") REFERENCES accounting_journals(id,"bookId") ON DELETE RESTRICT,
  FOREIGN KEY("documentId","bookId") REFERENCES accounting_general_documents(id,"bookId") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "accounting_general_document_members_journalId_bookId_key" ON accounting_general_document_members("journalId","bookId");
CREATE INDEX "accounting_general_document_members_documentId_idx" ON accounting_general_document_members("documentId");
CREATE TABLE accounting_general_document_lines (
  id UUID PRIMARY KEY, "bookId" UUID NOT NULL, "documentId" UUID NOT NULL, "accountId" UUID NOT NULL,
  debit DECIMAL(38,18) NOT NULL CHECK(debit>=0), credit DECIMAL(38,18) NOT NULL CHECK(credit>=0),
  FOREIGN KEY("documentId","bookId") REFERENCES accounting_general_documents(id,"bookId") ON DELETE RESTRICT,
  FOREIGN KEY("accountId","bookId") REFERENCES accounting_accounts(id,"bookId") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "accounting_general_document_lines_documentId_accountId_key" ON accounting_general_document_lines("documentId","accountId");
CREATE FUNCTION accounting_general_member_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'General document membership is immutable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM accounting_journals j JOIN accounting_general_documents d
    ON d.id=NEW."documentId" AND d."bookId"=j."bookId" AND d."periodId"=j."periodId"
    WHERE j.id=NEW."journalId" AND j.status='POSTED' AND j."documentDate"<=d."documentDate")
    THEN RAISE EXCEPTION 'Only same-period posted journals can form a general document'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER accounting_general_member_guard BEFORE INSERT OR UPDATE OR DELETE ON accounting_general_document_members
  FOR EACH ROW EXECUTE FUNCTION accounting_general_member_guard();
CREATE FUNCTION accounting_general_line_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'General document totals are immutable'; END IF;
  IF NOT EXISTS(SELECT 1 FROM accounting_accounts WHERE id=NEW."accountId" AND "bookId"=NEW."bookId" AND level='GENERAL')
    THEN RAISE EXCEPTION 'General document lines require a general account'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER accounting_general_line_guard BEFORE INSERT OR UPDATE OR DELETE ON accounting_general_document_lines
  FOR EACH ROW EXECUTE FUNCTION accounting_general_line_guard();
COMMIT;
