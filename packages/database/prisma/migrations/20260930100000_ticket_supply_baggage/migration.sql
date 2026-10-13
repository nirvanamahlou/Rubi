ALTER TABLE "TicketPublishedOffer"
  ADD COLUMN "supplyType" VARCHAR(16),
  ADD COLUMN "economyBaggageKg" DECIMAL(10,2),
  ADD COLUMN "businessBaggageKg" DECIMAL(10,2),
  ADD CONSTRAINT "TicketPublishedOffer_supplyType_check" CHECK ("supplyType" IS NULL OR "supplyType" IN ('COMPANY','FLOATING','API')),
  ADD CONSTRAINT "TicketPublishedOffer_baggage_check" CHECK (
    ("economyBaggageKg" IS NULL OR "economyBaggageKg" BETWEEN 0 AND 9999) AND
    ("businessBaggageKg" IS NULL OR "businessBaggageKg" BETWEEN 0 AND 9999)
  );
