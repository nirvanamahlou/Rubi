ALTER TABLE "PackagePricingTourDraft" ADD COLUMN "selectedHotelRateIds" JSONB;
ALTER TABLE "PackagePricingTourPublishedVersion" ADD COLUMN "selectedHotelRateIds" JSONB;
ALTER TABLE "PackagePricingTourPublishedRoomPrice" ADD COLUMN "roomTypeName" VARCHAR(160), ADD COLUMN "board" VARCHAR(120), ADD COLUMN "childAgeMin" INTEGER, ADD COLUMN "childAgeMaxExclusive" INTEGER;
