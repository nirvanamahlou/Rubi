-- Existing offers retain the default manifest; no passenger/history data changes.
ALTER TABLE "TicketPublishedOffer" ADD COLUMN "manifestTemplateId" UUID;
ALTER TABLE "TicketPublishedOffer" ADD CONSTRAINT "TicketPublishedOffer_manifestTemplateId_fkey"
FOREIGN KEY ("manifestTemplateId") REFERENCES "master_manifest_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TicketPublishedOffer_manifestTemplateId_idx" ON "TicketPublishedOffer"("manifestTemplateId");
