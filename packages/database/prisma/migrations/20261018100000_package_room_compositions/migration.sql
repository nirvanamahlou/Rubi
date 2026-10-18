ALTER TABLE "PackagePricingTourDraft" ADD COLUMN "selectedRoomKeys" JSONB;
ALTER TABLE "PackagePricingTourPublishedRoomPrice" ALTER COLUMN "roomCode" TYPE TEXT;
