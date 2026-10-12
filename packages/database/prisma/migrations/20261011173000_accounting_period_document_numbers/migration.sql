-- Source document numbers restart within each fiscal period. Existing numbers remain unchanged.
BEGIN;
CREATE UNIQUE INDEX "accounting_journals_bookId_periodId_number_key"
  ON "accounting_journals" ("bookId", "periodId", "number");
-- Preserve legacy uniqueness for incomplete journals without a period.
CREATE UNIQUE INDEX "accounting_journals_legacy_book_number_key"
  ON "accounting_journals" ("bookId", "number") WHERE "periodId" IS NULL;
DROP INDEX "accounting_journals_bookId_number_key";
COMMIT;
