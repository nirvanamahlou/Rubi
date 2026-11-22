ALTER TABLE "TicketPublishedOffer" ADD COLUMN "aircraftTypeId" UUID;

ALTER TABLE "TicketPublishedOffer"
ADD CONSTRAINT "TicketPublishedOffer_aircraftTypeId_fkey"
FOREIGN KEY ("aircraftTypeId") REFERENCES "master_aircraft_types"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
