CREATE TABLE "TicketOfferCapacityHold" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "offerId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "quantity" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMPTZ(3),
  CONSTRAINT "TicketOfferCapacityHold_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketOfferCapacityHold_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "TicketOfferCapacityHold_status_check" CHECK ("status" IN ('ACTIVE', 'RELEASED', 'EXPIRED')),
  CONSTRAINT "TicketOfferCapacityHold_expiry_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "TicketOfferCapacityHold_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TicketPublishedOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TicketOfferCapacityHold_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TicketOfferCapacityHold_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TicketOfferCapacityHold_createdByUserId_idempotencyKey_key" ON "TicketOfferCapacityHold"("createdByUserId", "idempotencyKey");
CREATE INDEX "TicketOfferCapacityHold_offerId_status_expiresAt_idx" ON "TicketOfferCapacityHold"("offerId", "status", "expiresAt");
CREATE INDEX "TicketOfferCapacityHold_branchId_expiresAt_idx" ON "TicketOfferCapacityHold"("branchId", "expiresAt");