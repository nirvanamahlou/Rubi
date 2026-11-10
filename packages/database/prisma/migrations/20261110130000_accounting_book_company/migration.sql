-- Existing books remain available with their IDs and financial references intact.
-- A legacy book is bound only by an explicit save in a selected company context.
ALTER TABLE accounting_books ADD COLUMN "legalEntityId" UUID;
ALTER TABLE accounting_books ADD CONSTRAINT "accounting_books_legalEntityId_fkey"
  FOREIGN KEY ("legalEntityId") REFERENCES legal_entities(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "accounting_books_legalEntityId_key" ON accounting_books("legalEntityId");
