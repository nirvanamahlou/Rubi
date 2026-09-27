-- Ticket Catalog commercial price destinations and Finance ticket purchase facts.
-- This migration is additive: historical price, cost, payment and request rows remain readable.

CREATE TABLE "TicketSalePriceTarget" (
  "id" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TicketSalePriceTarget_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketSalePriceTarget_version_check" CHECK ("version" > 0),
  CONSTRAINT "TicketSalePriceTarget_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TicketSalePriceTarget_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TicketSalePriceTarget_branchId_code_key"
  ON "TicketSalePriceTarget"("branchId", "code");
CREATE INDEX "TicketSalePriceTarget_branchId_isActive_name_idx"
  ON "TicketSalePriceTarget"("branchId", "isActive", "name");

ALTER TABLE "TicketOfferStandaloneSalePrice"
  ADD COLUMN "salePriceTargetId" UUID;
ALTER TABLE "TicketOfferStandaloneSalePrice"
  ADD CONSTRAINT "TicketOfferStandaloneSalePrice_salePriceTargetId_fkey"
  FOREIGN KEY ("salePriceTargetId") REFERENCES "TicketSalePriceTarget"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "TicketOfferStandaloneSalePrice_offerId_revision_key";
DROP INDEX "TicketOfferStandaloneSalePrice_offerId_occurredAt_idx";
CREATE UNIQUE INDEX "TicketStandaloneSalePrice_offer_target_revision_key"
  ON "TicketOfferStandaloneSalePrice"("offerId", "salePriceTargetId", "revision");
CREATE INDEX "TicketOfferStandaloneSalePrice_offerId_salePriceTargetId_occurredAt_idx"
  ON "TicketOfferStandaloneSalePrice"("offerId", "salePriceTargetId", "occurredAt");

ALTER TABLE "ProcurementTicketPurchaseRequest"
  ADD COLUMN "seatCount" INTEGER;
ALTER TABLE "ProcurementTicketPurchaseRequest"
  ADD CONSTRAINT "ProcurementTicketPurchaseRequest_seatCount_check"
  CHECK ("seatCount" IS NULL OR "seatCount" > 0);

ALTER TABLE "FinanceTicketPurchaseCostRevision"
  ADD COLUMN "seatCount" INTEGER,
  ADD COLUMN "unitCost" DECIMAL(24,4);
ALTER TABLE "FinanceTicketPurchaseCostRevision"
  ADD CONSTRAINT "FinanceTicketPurchaseCostRevision_seatCount_check"
  CHECK ("seatCount" IS NULL OR "seatCount" > 0),
  ADD CONSTRAINT "FinanceTicketPurchaseCostRevision_unitCost_check"
  CHECK ("unitCost" IS NULL OR "unitCost" > 0);

-- Reason was required by older forms. Preserve historical values while new ticket
-- procurement commands deliberately store no free-text explanation.
ALTER TABLE "FinanceTicketPurchaseCostRevision"
  ALTER COLUMN "reason" SET DEFAULT '';
ALTER TABLE "FinanceTicketPurchasePaymentRevision"
  ALTER COLUMN "reason" SET DEFAULT '';
