ALTER TABLE "sales_reservation_requests" ADD COLUMN "dispatchedAt" TIMESTAMPTZ(3);
ALTER TABLE "sales_contract_ticket_selections" ALTER COLUMN "quoted_amount" DROP NOT NULL;
ALTER TABLE "sales_contract_ticket_selections" ALTER COLUMN "quoted_currency_code" DROP NOT NULL;
CREATE TABLE "TicketPublishedOffer" (
  "id" UUID NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "branchId" UUID NOT NULL, "originId" UUID NOT NULL, "destinationId" UUID NOT NULL,
  "departureAt" TIMESTAMPTZ(3) NOT NULL, "arrivalAt" TIMESTAMPTZ(3) NOT NULL,
  "carrierName" VARCHAR(160) NOT NULL, "serviceNumber" VARCHAR(80) NOT NULL,
  "cabinClassCode" VARCHAR(20) NOT NULL, "totalCapacity" INTEGER NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE', "createdByUserId" UUID NOT NULL,
  "createKey" VARCHAR(160) NOT NULL, "fingerprint" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketPublishedOffer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketPublishedOffer_capacity_check" CHECK ("totalCapacity" >= 0),
  CONSTRAINT "TicketPublishedOffer_schedule_check" CHECK ("arrivalAt" > "departureAt"),
  CONSTRAINT "TicketPublishedOffer_route_check" CHECK ("originId" <> "destinationId"),
  CONSTRAINT "TicketPublishedOffer_status_check" CHECK ("status" IN ('ACTIVE', 'PAUSED')),
  CONSTRAINT "TicketPublishedOffer_cabin_check" CHECK ("cabinClassCode" IN ('ECONOMY', 'BUSINESS', 'FIRST'))
);
CREATE UNIQUE INDEX "TicketPublishedOffer_createdByUserId_createKey_key" ON "TicketPublishedOffer"("createdByUserId", "createKey");
CREATE INDEX "TicketPublishedOffer_branchId_originId_destinationId_depart_idx" ON "TicketPublishedOffer"("branchId", "originId", "destinationId", "departureAt");
CREATE TABLE "TicketOfferAudit" (
  "id" UUID NOT NULL, "offerId" UUID NOT NULL, "actorUserId" UUID NOT NULL,
  "action" VARCHAR(80) NOT NULL, "version" INTEGER NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TicketOfferAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketOfferAudit_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TicketPublishedOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TicketOfferAudit_offerId_occurredAt_idx" ON "TicketOfferAudit"("offerId", "occurredAt");
CREATE TABLE "ReservationIntake" (
  "id" UUID NOT NULL, "requestId" UUID NOT NULL, "contractId" UUID NOT NULL,
  "contractVersion" INTEGER NOT NULL, "branchId" UUID NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL, "snapshot" JSONB NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'QUEUED',
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationIntake_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReservationIntake_requestId_key" ON "ReservationIntake"("requestId");
CREATE UNIQUE INDEX "ReservationIntake_contractId_contractVersion_key" ON "ReservationIntake"("contractId", "contractVersion");
CREATE INDEX "ReservationIntake_branchId_receivedAt_idx" ON "ReservationIntake"("branchId", "receivedAt");
