CREATE TABLE "finance_purchase_fx_snapshots" (
  "id" UUID NOT NULL,
  "reservationPurchaseId" UUID UNIQUE REFERENCES "ReservationServicePurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "ticketCostId" UUID UNIQUE REFERENCES "FinanceTicketPurchaseCostRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "invoiceRevisionId" UUID UNIQUE REFERENCES "finance_procurement_invoice_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "branchId" UUID NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "actorUserId" UUID NOT NULL REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "currencyCode" VARCHAR(3) NOT NULL,
  "foreignAmount" DECIMAL(24,4) NOT NULL CHECK ("foreignAmount" > 0 AND "foreignAmount"::text NOT IN ('NaN','Infinity','-Infinity')),
  "rateToIrr" DECIMAL(24,8) NOT NULL CHECK ("rateToIrr" > 0 AND "rateToIrr"::text NOT IN ('NaN','Infinity','-Infinity')),
  "source" VARCHAR(32) NOT NULL CHECK ("source" IN ('MANUAL','SYSTEM_SELL','SYSTEM_REFERENCE')),
  "baselineAt" TIMESTAMPTZ(3) NOT NULL CHECK (isfinite("baselineAt")),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY("id"),
  CHECK (num_nonnulls("reservationPurchaseId","ticketCostId","invoiceRevisionId") = 1),
  CHECK ("currencyCode" ~ '^[A-Z]{3}$' AND "currencyCode" <> 'IRR')
);
CREATE INDEX "finance_purchase_fx_snapshots_branchId_baselineAt_idx" ON "finance_purchase_fx_snapshots"("branchId","baselineAt");
CREATE FUNCTION finance_purchase_fx_immutable() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'FINANCE_PURCHASE_FX_IMMUTABLE'; END;
$$;
CREATE TRIGGER finance_purchase_fx_immutable BEFORE UPDATE OR DELETE ON "finance_purchase_fx_snapshots" FOR EACH ROW EXECUTE FUNCTION finance_purchase_fx_immutable();
