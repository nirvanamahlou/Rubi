CREATE TABLE "TicketOfferStandaloneSalePrice" (
  "id" UUID NOT NULL,
  "offerId" UUID NOT NULL,
  "revision" INTEGER NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  "actorUserId" UUID NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "commandKey" VARCHAR(160) NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL,
  CONSTRAINT "TicketOfferStandaloneSalePrice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TicketOfferStandaloneSalePrice_positive_check" CHECK ("amount" > 0),
  CONSTRAINT "TicketOfferStandaloneSalePrice_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "TicketOfferStandaloneSalePrice_currency_check" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
  CONSTRAINT "TicketOfferStandaloneSalePrice_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TicketPublishedOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TicketOfferStandaloneSalePrice_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TicketOfferStandaloneSalePrice_offerId_revision_key" ON "TicketOfferStandaloneSalePrice"("offerId", "revision");
CREATE UNIQUE INDEX "TicketOfferStandaloneSalePrice_offerId_commandKey_key" ON "TicketOfferStandaloneSalePrice"("offerId", "commandKey");
CREATE INDEX "TicketOfferStandaloneSalePrice_offerId_occurredAt_idx" ON "TicketOfferStandaloneSalePrice"("offerId", "occurredAt");
