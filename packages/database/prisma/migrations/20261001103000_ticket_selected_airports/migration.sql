ALTER TABLE "TicketPublishedOffer" ADD COLUMN "originAirportId" UUID, ADD COLUMN "destinationAirportId" UUID;
ALTER TABLE "TicketPublishedOffer" ADD CONSTRAINT "TicketPublishedOffer_originAirportId_fkey" FOREIGN KEY ("originAirportId") REFERENCES "master_airports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TicketPublishedOffer" ADD CONSTRAINT "TicketPublishedOffer_destinationAirportId_fkey" FOREIGN KEY ("destinationAirportId") REFERENCES "master_airports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
