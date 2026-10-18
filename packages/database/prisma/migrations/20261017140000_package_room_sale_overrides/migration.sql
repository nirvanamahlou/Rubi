-- Package sale overrides do not alter supplier purchase tariffs.
ALTER TABLE "PackagePricingTourDraft" ADD COLUMN "roomSaleOverrides" JSONB;
