CREATE TABLE sales_payment_refunds (
 id UUID PRIMARY KEY REFERENCES finance_operational_revisions(id) ON DELETE RESTRICT,
 "paymentId" UUID NOT NULL REFERENCES sales_contract_payment_entries(id) ON DELETE RESTRICT,
 amount DECIMAL(24,4) NOT NULL CHECK (amount>0),
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX sales_payment_refunds_payment_idx ON sales_payment_refunds ("paymentId");
CREATE FUNCTION guard_sales_payment_refund() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Confirmed payment refunds are immutable'; END $$;
CREATE TRIGGER sales_payment_refund_immutable BEFORE UPDATE OR DELETE ON sales_payment_refunds
FOR EACH ROW EXECUTE FUNCTION guard_sales_payment_refund();
