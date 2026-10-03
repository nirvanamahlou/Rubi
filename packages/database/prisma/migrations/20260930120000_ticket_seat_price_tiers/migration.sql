CREATE TABLE "TicketOfferSalePriceTier" (
  "id" UUID NOT NULL,
  "standalonePriceId" UUID,
  "roundTripPriceId" UUID,
  "tierIndex" INTEGER NOT NULL,
  "seatCount" INTEGER NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  CONSTRAINT "TicketOfferSalePriceTier_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketOfferSalePriceTier_exactly_one_price_check" CHECK (("standalonePriceId" IS NULL) <> ("roundTripPriceId" IS NULL)),
  CONSTRAINT "TicketOfferSalePriceTier_index_check" CHECK ("tierIndex" > 0),
  CONSTRAINT "TicketOfferSalePriceTier_count_check" CHECK ("seatCount" > 0),
  CONSTRAINT "TicketOfferSalePriceTier_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "TicketOfferSalePriceTier_currency_check" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
  CONSTRAINT "TicketOfferSalePriceTier_standalonePriceId_fkey" FOREIGN KEY ("standalonePriceId") REFERENCES "TicketOfferStandaloneSalePrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TicketOfferSalePriceTier_roundTripPriceId_fkey" FOREIGN KEY ("roundTripPriceId") REFERENCES "TicketOfferRoundTripSalePrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TicketOfferSalePriceTier_standalonePriceId_tierIndex_key" ON "TicketOfferSalePriceTier"("standalonePriceId", "tierIndex");
CREATE UNIQUE INDEX "TicketOfferSalePriceTier_roundTripPriceId_tierIndex_key" ON "TicketOfferSalePriceTier"("roundTripPriceId", "tierIndex");
CREATE INDEX "TicketOfferSalePriceTier_standalonePriceId_idx" ON "TicketOfferSalePriceTier"("standalonePriceId");
CREATE INDEX "TicketOfferSalePriceTier_roundTripPriceId_idx" ON "TicketOfferSalePriceTier"("roundTripPriceId");

CREATE FUNCTION ticket_sale_price_tier_immutable() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Ticket sale price tiers are immutable';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "TicketOfferSalePriceTier_immutable"
BEFORE UPDATE OR DELETE ON "TicketOfferSalePriceTier"
FOR EACH ROW EXECUTE FUNCTION ticket_sale_price_tier_immutable();
