ALTER TABLE "reservation_hotel_rate_packs" ADD COLUMN "tourDepartureId" UUID;
ALTER TABLE "reservation_hotel_rate_batches" ADD COLUMN "tourDepartureId" UUID;
ALTER TABLE "reservation_hotel_rate_packs" ADD CONSTRAINT "reservation_hotel_rate_packs_tourDepartureId_fkey" FOREIGN KEY ("tourDepartureId") REFERENCES "TourDeparture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservation_hotel_rate_batches" ADD CONSTRAINT "reservation_hotel_rate_batches_tourDepartureId_fkey" FOREIGN KEY ("tourDepartureId") REFERENCES "TourDeparture"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PackagePricingTourDraft" ADD COLUMN "familyAdults" INTEGER, ADD COLUMN "familyChildren" INTEGER;
ALTER TABLE "PackagePricingTourPublishedVersion" ADD COLUMN "familyAdults" INTEGER, ADD COLUMN "familyChildren" INTEGER;
ALTER TABLE "PackagePricingTourPublishedRoomPrice" ADD COLUMN "currencyAmounts" JSONB;
