CREATE TABLE "TicketOfferCapacityAllocation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "offerId" UUID NOT NULL,
    "contractId" UUID NOT NULL,
    "direction" VARCHAR(20) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMPTZ(3),

    CONSTRAINT "TicketOfferCapacityAllocation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TicketOfferCapacityAllocation_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "TicketOfferCapacityAllocation_direction_check" CHECK ("direction" IN ('OUTBOUND', 'RETURN')),
    CONSTRAINT "TicketOfferCapacityAllocation_status_check" CHECK ("status" IN ('ACTIVE', 'RELEASED')),
    CONSTRAINT "TicketOfferCapacityAllocation_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TicketPublishedOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TicketOfferCapacityAllocation_contractId_direction_key"
ON "TicketOfferCapacityAllocation"("contractId", "direction");

CREATE INDEX "TicketOfferCapacityAllocation_offerId_status_idx"
ON "TicketOfferCapacityAllocation"("offerId", "status");

CREATE INDEX "TicketOfferCapacityAllocation_contractId_status_idx"
ON "TicketOfferCapacityAllocation"("contractId", "status");
