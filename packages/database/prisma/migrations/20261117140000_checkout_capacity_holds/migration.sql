CREATE TABLE "website_checkout_sessions" (
 "id" UUID NOT NULL DEFAULT gen_random_uuid(), "siteCode" VARCHAR(40) NOT NULL,
 "branchId" UUID NOT NULL, "createdByUserId" UUID NOT NULL, "externalId" VARCHAR(100) NOT NULL,
 "customerExternalId" VARCHAR(100) NOT NULL, "fingerprint" CHAR(64) NOT NULL,
 "quoteSnapshot" JSONB NOT NULL, "requesterName" VARCHAR(160) NOT NULL,
 "requesterPhone" VARCHAR(40) NOT NULL, "expiresAt" TIMESTAMPTZ(3) NOT NULL,
 "status" VARCHAR(24) NOT NULL DEFAULT 'PREPARED', "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "website_checkout_sessions_pkey" PRIMARY KEY("id"),
 CONSTRAINT "website_checkout_sessions_branchId_fkey" FOREIGN KEY("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "website_checkout_sessions_createdByUserId_fkey" FOREIGN KEY("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "website_checkout_sessions_siteCode_branchId_externalId_key" ON "website_checkout_sessions"("siteCode","branchId","externalId");
CREATE INDEX "website_checkout_sessions_branchId_customerExternalId_status_idx" ON "website_checkout_sessions"("branchId","customerExternalId","status");
ALTER TABLE "TicketOfferCapacityHold"
 ADD COLUMN "checkoutContractId" UUID, ADD COLUMN "checkoutSessionId" UUID,
 ADD COLUMN "checkoutQuoteFingerprint" CHAR(64), ADD COLUMN "requesterPhone" VARCHAR(40),
 ADD COLUMN "paymentPendingAt" TIMESTAMPTZ(3), ADD COLUMN "paymentAttemptKey" VARCHAR(160);
ALTER TABLE "TicketOfferCapacityHold"
 ADD CONSTRAINT "TicketOfferCapacityHold_checkoutContractId_fkey" FOREIGN KEY ("checkoutContractId") REFERENCES "sales_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT "TicketOfferCapacityHold_checkoutSessionId_fkey" FOREIGN KEY ("checkoutSessionId") REFERENCES "website_checkout_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 ADD CONSTRAINT "checkout_hold_payment_binding" CHECK (("paymentPendingAt" IS NULL AND "paymentAttemptKey" IS NULL) OR ("checkoutSessionId" IS NOT NULL AND "paymentPendingAt" IS NOT NULL AND "paymentAttemptKey" IS NOT NULL));
CREATE UNIQUE INDEX "TicketOfferCapacityHold_checkoutSessionId_offerId_key" ON "TicketOfferCapacityHold"("checkoutSessionId","offerId");
CREATE UNIQUE INDEX "TicketOfferCapacityHold_checkoutContractId_offerId_key" ON "TicketOfferCapacityHold"("checkoutContractId","offerId");
CREATE INDEX "TicketOfferCapacityHold_checkoutContractId_status_idx" ON "TicketOfferCapacityHold"("checkoutContractId","status");

ALTER TABLE "website_checkout_sessions" ADD COLUMN "contractId" UUID, ADD COLUMN "paymentAttemptKey" VARCHAR(160), ADD COLUMN "resolutionFingerprint" CHAR(64);
ALTER TABLE "website_checkout_sessions" ADD CONSTRAINT "website_checkout_sessions_contractId_fkey" FOREIGN KEY("contractId") REFERENCES "sales_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "website_checkout_sessions_contractId_key" ON "website_checkout_sessions"("contractId");
