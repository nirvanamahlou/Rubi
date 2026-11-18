ALTER TABLE accounting_periods ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- The selected default is company/book-owned, never inferred from old records.
CREATE UNIQUE INDEX accounting_periods_one_default_per_book
  ON accounting_periods ("bookId") WHERE "isDefault" = true;

ALTER TABLE finance_accounting_events ADD COLUMN "fiscalPeriodId" UUID;
ALTER TABLE finance_accounting_events ADD CONSTRAINT finance_accounting_events_fiscal_period_fk
  FOREIGN KEY ("fiscalPeriodId") REFERENCES accounting_periods(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX finance_accounting_events_fiscal_period_idx ON finance_accounting_events("fiscalPeriodId");
ALTER TABLE finance_operational_requests ADD COLUMN "fiscalPeriodId" UUID;
ALTER TABLE finance_operational_requests ADD CONSTRAINT finance_requests_fiscal_period_fk
  FOREIGN KEY ("fiscalPeriodId") REFERENCES accounting_periods(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX finance_requests_fiscal_period_idx ON finance_operational_requests("fiscalPeriodId");
