ALTER TABLE finance_accounting_events ADD COLUMN "trackingNumber" VARCHAR(160), ADD COLUMN "trackingDate" VARCHAR(10);
ALTER TABLE finance_accounting_events ADD CONSTRAINT financial_tracking_date CHECK ("trackingDate" IS NULL OR "trackingDate" ~ '^\d{4}-\d{2}-\d{2}$');
