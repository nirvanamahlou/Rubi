BEGIN;
ALTER TABLE sales_contracts ADD COLUMN reservation_hidden_at timestamptz(3), ADD COLUMN finance_hidden_at timestamptz(3);
UPDATE sales_contracts SET reservation_hidden_at = hidden_at, finance_hidden_at = hidden_at WHERE hidden_at IS NOT NULL;
COMMIT;
