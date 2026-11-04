CREATE TABLE "TicketOfferSaleRoute" (
 "offerId" UUID NOT NULL,
 "originId" UUID NOT NULL,
 "destinationId" UUID NOT NULL,
 CONSTRAINT "TicketOfferSaleRoute_pkey" PRIMARY KEY ("offerId", "originId", "destinationId"),
 CONSTRAINT "TicketOfferSaleRoute_distinct_endpoints" CHECK ("originId" <> "destinationId"),
 CONSTRAINT "TicketOfferSaleRoute_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TicketPublishedOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "TicketOfferSaleRoute_originId_fkey" FOREIGN KEY ("originId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "TicketOfferSaleRoute_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "master_cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "TicketOfferSaleRoute_originId_destinationId_idx" ON "TicketOfferSaleRoute"("originId","destinationId");
CREATE INDEX "TicketOfferSaleRoute_destinationId_idx" ON "TicketOfferSaleRoute"("destinationId");
