-- Manual rollback only; refuse to discard any recorded payment terms.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "sales_contracts" WHERE "payment_terms" IS NOT NULL) THEN
    RAISE EXCEPTION 'Cannot roll back recorded Sales payment terms';
  END IF;
END $$;
ALTER TABLE "sales_contracts" DROP COLUMN "payment_terms";
COMMIT;
