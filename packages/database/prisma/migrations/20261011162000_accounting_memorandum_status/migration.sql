ALTER TABLE accounting_journals DROP CONSTRAINT accounting_journal_status;
ALTER TABLE accounting_journals ADD CONSTRAINT accounting_journal_status
CHECK (status IN ('MEMORANDUM','DRAFT','PENDING_APPROVAL','APPROVED','POSTED','CANCELLED'));
