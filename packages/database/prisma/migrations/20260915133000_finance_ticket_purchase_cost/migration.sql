-- Additive: keep every historical Ticket purchase estimate but allow new amount-free requests.
ALTER TABLE "ProcurementTicketPurchaseRequest"
  ALTER COLUMN "serviceDate" DROP NOT NULL,
  ALTER COLUMN "amount" DROP NOT NULL,
  ALTER COLUMN "currencyCode" DROP NOT NULL,
  ADD COLUMN "offerId" UUID,
  ADD COLUMN "offerVersion" INTEGER;

ALTER TABLE "ProcurementTicketPurchaseRequest"
  DROP CONSTRAINT "ProcurementTicketPurchaseRequest_amount_positive";
ALTER TABLE "ProcurementTicketPurchaseRequest"
  ADD CONSTRAINT "ProcurementTicketPurchaseRequest_amount_positive"
    CHECK ("amount" IS NULL OR "amount" > 0),
  ADD CONSTRAINT "ProcurementTicketPurchaseRequest_currency_code_nullable"
    CHECK ("currencyCode" IS NULL OR "currencyCode" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "ProcurementTicketPurchaseRequest_offer_pair"
    CHECK (("offerId" IS NULL AND "offerVersion" IS NULL) OR
           ("offerId" IS NOT NULL AND "offerVersion" > 0)),
  ADD CONSTRAINT "ProcurementTicketPurchaseRequest_offerId_fkey"
    FOREIGN KEY ("offerId") REFERENCES "TicketPublishedOffer"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ProcurementTicketPurchaseRequest_offerId_key"
  ON "ProcurementTicketPurchaseRequest"("offerId");

CREATE TABLE "FinanceTicketPurchaseCostRevision" (
  "id" UUID NOT NULL PRIMARY KEY,
  "requestId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "offerId" UUID,
  "offerVersion" INTEGER,
  "version" INTEGER NOT NULL,
  "adultUnitCost" DECIMAL(24,4) NOT NULL,
  "childUnitCost" DECIMAL(24,4) NOT NULL,
  "invoiceAmount" DECIMAL(24,4) NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "actorUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceTicketCost_amounts" CHECK
    ("adultUnitCost" >= 0 AND "childUnitCost" >= 0 AND "invoiceAmount" > 0),
  CONSTRAINT "FinanceTicketCost_currency" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
  CONSTRAINT "FinanceTicketCost_version" CHECK ("version" > 0),
  CONSTRAINT "FinanceTicketCost_offer_pair" CHECK
    (("offerId" IS NULL AND "offerVersion" IS NULL) OR
     ("offerId" IS NOT NULL AND "offerVersion" > 0)),
  CONSTRAINT "FinanceTicketCost_request_fkey" FOREIGN KEY ("requestId")
    REFERENCES "ProcurementTicketPurchaseRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceTicketCost_branch_fkey" FOREIGN KEY ("branchId")
    REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceTicketCost_offer_fkey" FOREIGN KEY ("offerId")
    REFERENCES "TicketPublishedOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceTicketCost_actor_fkey" FOREIGN KEY ("actorUserId")
    REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinanceTicketPurchaseCostRevision_requestId_version_key"
  ON "FinanceTicketPurchaseCostRevision"("requestId", "version");
CREATE INDEX "FinanceTicketPurchaseCostRevision_branchId_offerId_version_idx"
  ON "FinanceTicketPurchaseCostRevision"("branchId", "offerId", "version");

CREATE TABLE "FinanceTicketPurchasePaymentRevision" (
  "id" UUID NOT NULL PRIMARY KEY,
  "costRevisionId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" "FinanceSupplierPaymentStatus" NOT NULL,
  "accountId" UUID NOT NULL,
  "paymentMethodId" UUID NOT NULL,
  "paidAmount" DECIMAL(24,4) NOT NULL,
  "cumulativePaid" DECIMAL(24,4) NOT NULL,
  "remainingAmount" DECIMAL(24,4) NOT NULL,
  "exchangeRateToIrr" DECIMAL(24,8) NOT NULL,
  "rialEquivalent" DECIMAL(24,4) NOT NULL,
  "transferAt" TIMESTAMPTZ(3) NOT NULL,
  "paymentReference" VARCHAR(160),
  "reason" VARCHAR(500) NOT NULL,
  "actorUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceTicketPayment_amounts" CHECK
    ("version" > 0 AND "paidAmount" > 0 AND "cumulativePaid" > 0 AND
     "remainingAmount" >= 0 AND "exchangeRateToIrr" > 0 AND "rialEquivalent" > 0),
  CONSTRAINT "FinanceTicketPayment_cost_fkey" FOREIGN KEY ("costRevisionId")
    REFERENCES "FinanceTicketPurchaseCostRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceTicketPayment_account_fkey" FOREIGN KEY ("accountId")
    REFERENCES "FinanceSettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceTicketPayment_method_fkey" FOREIGN KEY ("paymentMethodId")
    REFERENCES "master_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceTicketPayment_actor_fkey" FOREIGN KEY ("actorUserId")
    REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinanceTicketPurchasePaymentRevision_costRevisionId_version_key"
  ON "FinanceTicketPurchasePaymentRevision"("costRevisionId", "version");
CREATE INDEX "FinanceTicketPurchasePaymentRevision_status_createdAt_idx"
  ON "FinanceTicketPurchasePaymentRevision"("status", "createdAt");

CREATE FUNCTION finance_ticket_purchase_revision_immutable() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Finance ticket purchase revisions are immutable';
END;
$$;
CREATE TRIGGER finance_ticket_cost_no_mutation BEFORE UPDATE OR DELETE
  ON "FinanceTicketPurchaseCostRevision" FOR EACH ROW
  EXECUTE FUNCTION finance_ticket_purchase_revision_immutable();
CREATE TRIGGER finance_ticket_payment_no_mutation BEFORE UPDATE OR DELETE
  ON "FinanceTicketPurchasePaymentRevision" FOR EACH ROW
  EXECUTE FUNCTION finance_ticket_purchase_revision_immutable();
