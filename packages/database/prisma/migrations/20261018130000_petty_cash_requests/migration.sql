ALTER TABLE finance_operational_requests ADD COLUMN "pettyFundId" UUID;
ALTER TABLE finance_operational_requests ADD CONSTRAINT petty_fund_fk FOREIGN KEY ("pettyFundId") REFERENCES finance_operational_requests(id) ON DELETE RESTRICT;
CREATE INDEX petty_fund_requests_idx ON finance_operational_requests ("pettyFundId");
ALTER TABLE finance_operational_requests DROP CONSTRAINT finance_request_status;
ALTER TABLE finance_operational_requests ADD CONSTRAINT finance_request_status CHECK (status IN ('NEW','UNDER_REVIEW','CORRECTION_REQUIRED','APPROVED','PAYING','PAID','REJECTED','CANCELLED','CLOSED'));
ALTER TABLE finance_operational_requests ADD CONSTRAINT petty_fund_kind CHECK (
 (kind IN ('PETTY_CASH_TOPUP','PETTY_CASH_EXPENSE','PETTY_CASH_RETURN') AND "pettyFundId" IS NOT NULL AND "pettyFundId"<>id)
 OR (kind NOT IN ('PETTY_CASH_TOPUP','PETTY_CASH_EXPENSE','PETTY_CASH_RETURN') AND "pettyFundId" IS NULL)
);
