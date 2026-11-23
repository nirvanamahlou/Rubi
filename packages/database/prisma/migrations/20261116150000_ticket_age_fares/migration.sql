-- Additive: historical immutable fares retain legacy behavior via NULL.
ALTER TABLE "TicketOfferStandaloneSalePrice" ADD COLUMN "childAmount" DECIMAL(20,4), ADD COLUMN "infantAmount" DECIMAL(20,4);
ALTER TABLE "TicketOfferRoundTripSalePrice" ADD COLUMN "childAmount" DECIMAL(20,4), ADD COLUMN "infantAmount" DECIMAL(20,4);
ALTER TABLE "TicketOfferStandaloneSalePrice" ADD CONSTRAINT "standalone_age_fares_nonnegative" CHECK (("childAmount" IS NULL OR "childAmount">=0) AND ("infantAmount" IS NULL OR "infantAmount">=0));
ALTER TABLE "TicketOfferRoundTripSalePrice" ADD CONSTRAINT "roundtrip_age_fares_nonnegative" CHECK (("childAmount" IS NULL OR "childAmount">=0) AND ("infantAmount" IS NULL OR "infantAmount">=0));
