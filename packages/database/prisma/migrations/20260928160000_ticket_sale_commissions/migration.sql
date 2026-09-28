CREATE TABLE "TicketSaleCommissionRevision" (
 "id" UUID NOT NULL, "offerId" UUID NOT NULL, "returnOfferId" UUID,
 "salePriceTargetId" UUID, "scopeKey" VARCHAR(130) NOT NULL,
 "revision" INTEGER NOT NULL, "percent" DECIMAL(7,4) NOT NULL,
 "actorUserId" UUID NOT NULL, "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "commandKey" VARCHAR(160) NOT NULL, "fingerprint" VARCHAR(64) NOT NULL,
 CONSTRAINT "TicketSaleCommissionRevision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "TicketSaleCommissionRevision_percent_check" CHECK ("percent" >= 0 AND "percent" <= 100),
 CONSTRAINT "TicketSaleCommissionRevision_revision_check" CHECK ("revision" > 0),
 CONSTRAINT "TicketSaleCommissionRevision_pair_check" CHECK ("offerId" IS DISTINCT FROM "returnOfferId"),
 CONSTRAINT "TicketSaleCommissionRevision_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "TicketPublishedOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "TicketSaleCommissionRevision_returnOfferId_fkey" FOREIGN KEY ("returnOfferId") REFERENCES "TicketPublishedOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "TicketSaleCommissionRevision_salePriceTargetId_fkey" FOREIGN KEY ("salePriceTargetId") REFERENCES "TicketSalePriceTarget"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "TicketSaleCommissionRevision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TicketSaleCommissionRevision_scopeKey_revision_key" ON "TicketSaleCommissionRevision"("scopeKey", "revision");
CREATE UNIQUE INDEX "TicketSaleCommissionRevision_scopeKey_commandKey_key" ON "TicketSaleCommissionRevision"("scopeKey", "commandKey");
CREATE INDEX "TicketSaleCommissionRevision_offerId_revision_idx" ON "TicketSaleCommissionRevision"("offerId", "revision");
CREATE INDEX "TicketSaleCommissionRevision_returnOfferId_idx" ON "TicketSaleCommissionRevision"("returnOfferId");
CREATE INDEX "TicketSaleCommissionRevision_salePriceTargetId_idx" ON "TicketSaleCommissionRevision"("salePriceTargetId");

CREATE FUNCTION "ticket_sale_commission_append_only"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'Ticket sale commissions are append-only; create a new revision';
END;
$$;
CREATE TRIGGER "ticket_sale_commission_append_only" BEFORE UPDATE OR DELETE ON "TicketSaleCommissionRevision"
FOR EACH ROW EXECUTE FUNCTION "ticket_sale_commission_append_only"();
