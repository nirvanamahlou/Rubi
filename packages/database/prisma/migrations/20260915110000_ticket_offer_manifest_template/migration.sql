ALTER TABLE "TicketPublishedOffer"
  ADD COLUMN "manifestTemplateId" UUID,
  ADD COLUMN "manifestTemplateName" VARCHAR(160),
  ADD COLUMN "manifestTemplateVersion" INTEGER,
  ADD COLUMN "manifestTemplateFileReferenceId" UUID;

CREATE INDEX "TicketPublishedOffer_manifestTemplateId_idx"
  ON "TicketPublishedOffer"("manifestTemplateId");

ALTER TABLE "TicketPublishedOffer"
  ADD CONSTRAINT "TicketPublishedOffer_manifestTemplateId_fkey"
  FOREIGN KEY ("manifestTemplateId") REFERENCES "master_manifest_templates"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
