ALTER TABLE "website_publications" ADD COLUMN "presentation" JSONB;
-- Publishing a base price makes it eligible, not automatically selected for a website.
DROP TRIGGER IF EXISTS website_tour_auto_publish ON "PackagePricingTourPublishedVersion";
DROP TRIGGER IF EXISTS website_ticket_auto_publish ON "TicketOfferStandaloneSalePrice";
