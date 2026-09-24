CREATE TABLE "TicketOfferRoundTripSalePrice" (
  "id" UUID NOT NULL,
  "outboundOfferId" UUID NOT NULL,
  "returnOfferId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  "actorUserId" UUID NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "commandKey" VARCHAR(160) NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  CONSTRAINT "TicketOfferRoundTripSalePrice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketOfferRoundTripSalePrice_distinct_offers_check" CHECK ("outboundOfferId" <> "returnOfferId"),
  CONSTRAINT "TicketOfferRoundTripSalePrice_positive_check" CHECK ("amount" > 0),
  CONSTRAINT "TicketOfferRoundTripSalePrice_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "TicketOfferRoundTripSalePrice_currency_check" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
  CONSTRAINT "TicketOfferRoundTripSalePrice_outboundOfferId_fkey" FOREIGN KEY ("outboundOfferId") REFERENCES "TicketPublishedOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TicketOfferRoundTripSalePrice_returnOfferId_fkey" FOREIGN KEY ("returnOfferId") REFERENCES "TicketPublishedOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TicketOfferRoundTripSalePrice_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TicketRoundTripPrice_pair_revision_key" ON "TicketOfferRoundTripSalePrice"("outboundOfferId", "returnOfferId", "revision");
CREATE UNIQUE INDEX "TicketRoundTripPrice_pair_command_key" ON "TicketOfferRoundTripSalePrice"("outboundOfferId", "returnOfferId", "commandKey");
CREATE INDEX "TicketOfferRoundTripSalePrice_outboundOfferId_returnOfferId_occurredAt_idx" ON "TicketOfferRoundTripSalePrice"("outboundOfferId", "returnOfferId", "occurredAt");
CREATE INDEX "TicketOfferRoundTripSalePrice_returnOfferId_idx" ON "TicketOfferRoundTripSalePrice"("returnOfferId");
