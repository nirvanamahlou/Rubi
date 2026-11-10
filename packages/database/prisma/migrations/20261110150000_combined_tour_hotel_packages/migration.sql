ALTER TABLE "PackagePricingTourDraft" ADD COLUMN "hotelCombinations" JSONB;
ALTER TABLE "PackagePricingTourPublishedVersion" ADD COLUMN "hotelCombinations" JSONB;
CREATE TABLE "PackagePricingTourCombinationSource" (
 "id" UUID NOT NULL PRIMARY KEY,
 "draftId" UUID NOT NULL REFERENCES "PackagePricingTourDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "publicationId" UUID REFERENCES "PackagePricingTourPublishedVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "hotelRateId" UUID NOT NULL REFERENCES "ReservationHotelGroupRate"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "combinationKey" VARCHAR(80) NOT NULL,
 "ordinal" INTEGER NOT NULL CHECK ("ordinal">0)
);
CREATE INDEX "PackagePricingTourCombinationSource_draftId_publicationId_idx" ON "PackagePricingTourCombinationSource"("draftId","publicationId");
CREATE INDEX "PackagePricingTourCombinationSource_hotelRateId_idx" ON "PackagePricingTourCombinationSource"("hotelRateId");
