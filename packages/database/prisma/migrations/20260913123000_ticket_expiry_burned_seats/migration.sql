ALTER TABLE "TicketPublishedOffer"
  ADD COLUMN "companyOwned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "expiredAt" TIMESTAMPTZ(3),
  ADD COLUMN "burnedSeatCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "TicketPublishedOffer"
  DROP CONSTRAINT "TicketPublishedOffer_status_check",
  ADD CONSTRAINT "TicketPublishedOffer_status_check"
  CHECK ("status" IN ('ACTIVE', 'PAUSED', 'EXPIRED'));

ALTER TABLE "TicketPublishedOffer"
  ADD CONSTRAINT "TicketPublishedOffer_burnedSeatCount_check"
  CHECK ("burnedSeatCount" >= 0 AND "burnedSeatCount" <= "totalCapacity");

CREATE INDEX "TicketPublishedOffer_status_departureAt_idx"
  ON "TicketPublishedOffer"("status", "departureAt");

CREATE INDEX "TicketPublishedOffer_branchId_companyOwned_status_idx"
  ON "TicketPublishedOffer"("branchId", "companyOwned", "status");

COMMENT ON COLUMN "TicketPublishedOffer"."expiredAt" IS
  'Automatic sale expiry timestamp; the offer is retained for contracts and auditability.';

COMMENT ON COLUMN "TicketPublishedOffer"."burnedSeatCount" IS
  'Immutable unsold company-owned seats captured when the offer first expires.';
