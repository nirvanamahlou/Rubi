-- Additive Sales-owned tour drafts and immutable per-hotel/room publications.
CREATE TABLE "PackagePricingTourDraft" (
  "id" UUID PRIMARY KEY,
  "tourDepartureId" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "currencyCode" VARCHAR(3) NOT NULL,
  "adultFlightSale" DECIMAL(24,4) NOT NULL,
  "childFlightSale" DECIMAL(24,4) NOT NULL,
  "businessUplift" DECIMAL(24,4) NOT NULL,
  "commissionPercent" DECIMAL(10,4) NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "TourDraft_money" CHECK ("adultFlightSale" >= 0 AND "childFlightSale" >= 0
    AND "businessUplift" >= 0 AND "commissionPercent" >= 0 AND "commissionPercent" <= 100),
  CONSTRAINT "TourDraft_currency" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
  CONSTRAINT "TourDraft_version" CHECK ("version" > 0),
  CONSTRAINT "PackagePricingTourDraft_tourDepartureId_fkey" FOREIGN KEY ("tourDepartureId")
    REFERENCES "TourDeparture"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagePricingTourDraft_batchId_fkey" FOREIGN KEY ("batchId")
    REFERENCES "reservation_hotel_rate_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagePricingTourDraft_branchId_fkey" FOREIGN KEY ("branchId")
    REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagePricingTourDraft_createdByUserId_fkey" FOREIGN KEY ("createdByUserId")
    REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagePricingTourDraft_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId")
    REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PackagePricingTourDraft_tourDepartureId_batchId_key"
  ON "PackagePricingTourDraft"("tourDepartureId", "batchId");
CREATE INDEX "PackagePricingTourDraft_branchId_updatedAt_idx"
  ON "PackagePricingTourDraft"("branchId", "updatedAt");

CREATE TABLE "PackagePricingTourAdjustment" (
  "id" UUID PRIMARY KEY,
  "draftId" UUID NOT NULL,
  "hotelRateId" UUID NOT NULL,
  "direction" VARCHAR(12) NOT NULL,
  "mode" VARCHAR(12) NOT NULL,
  "value" DECIMAL(24,4) NOT NULL,
  CONSTRAINT "TourAdjustment_valid" CHECK ("direction" IN ('increase', 'decrease')
    AND "mode" IN ('percent', 'fixed') AND "value" >= 0),
  CONSTRAINT "PackagePricingTourAdjustment_draftId_fkey" FOREIGN KEY ("draftId")
    REFERENCES "PackagePricingTourDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagePricingTourAdjustment_hotelRateId_fkey" FOREIGN KEY ("hotelRateId")
    REFERENCES "reservation_hotel_group_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PackagePricingTourAdjustment_draftId_hotelRateId_key"
  ON "PackagePricingTourAdjustment"("draftId", "hotelRateId");

CREATE TABLE "PackagePricingTourPublishedVersion" (
  "id" UUID PRIMARY KEY,
  "draftId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "draftVersion" INTEGER NOT NULL,
  "tourVersion" INTEGER NOT NULL,
  "sourceFingerprint" VARCHAR(64) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "outboundCostRevisionId" UUID NOT NULL,
  "returnCostRevisionId" UUID,
  "adultFlightSale" DECIMAL(24,4) NOT NULL,
  "childFlightSale" DECIMAL(24,4) NOT NULL,
  "businessUplift" DECIMAL(24,4) NOT NULL,
  "commissionPercent" DECIMAL(10,4) NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  "publishedByUserId" UUID NOT NULL,
  "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourPublication_valid" CHECK ("version" > 0 AND "draftVersion" > 0 AND "tourVersion" > 0
    AND "adultFlightSale" >= 0 AND "childFlightSale" >= 0 AND "businessUplift" >= 0
    AND "commissionPercent" >= 0 AND "commissionPercent" <= 100
    AND "currencyCode" ~ '^[A-Z]{3}$' AND "sourceFingerprint" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "PackagePricingTourPublishedVersion_draftId_fkey" FOREIGN KEY ("draftId")
    REFERENCES "PackagePricingTourDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagePricingTourPublishedVersion_outboundCostRevisionId_fkey" FOREIGN KEY ("outboundCostRevisionId")
    REFERENCES "FinanceTicketPurchaseCostRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagePricingTourPublishedVersion_returnCostRevisionId_fkey" FOREIGN KEY ("returnCostRevisionId")
    REFERENCES "FinanceTicketPurchaseCostRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagePricingTourPublishedVersion_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId")
    REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PackagePricingTourPublishedVersion_draftId_version_key"
  ON "PackagePricingTourPublishedVersion"("draftId", "version");

CREATE TABLE "PackagePricingTourPublishedRoomPrice" (
  "id" UUID PRIMARY KEY,
  "publicationId" UUID NOT NULL,
  "hotelRateId" UUID NOT NULL,
  "roomCode" VARCHAR(32) NOT NULL,
  "hotelPurchase" DECIMAL(24,4) NOT NULL,
  "hotelSale" DECIMAL(24,4) NOT NULL,
  "packagePurchase" DECIMAL(24,4),
  "packageSale" DECIMAL(24,4),
  "commissionAmount" DECIMAL(24,4),
  "netProfit" DECIMAL(24,4),
  "currencyCode" VARCHAR(3) NOT NULL,
  CONSTRAINT "TourRoomPrice_valid" CHECK ("hotelPurchase" >= 0 AND "hotelSale" >= 0
    AND ("packagePurchase" IS NULL OR "packagePurchase" >= 0)
    AND ("packageSale" IS NULL OR "packageSale" >= 0)
    AND ("commissionAmount" IS NULL OR "commissionAmount" >= 0)
    AND (("packagePurchase" IS NULL AND "packageSale" IS NULL AND "commissionAmount" IS NULL AND "netProfit" IS NULL)
      OR ("packagePurchase" IS NOT NULL AND "packageSale" IS NOT NULL AND "commissionAmount" IS NOT NULL AND "netProfit" IS NOT NULL))
    AND "currencyCode" ~ '^[A-Z]{3}$'),
  CONSTRAINT "PackagePricingTourPublishedRoomPrice_publicationId_fkey" FOREIGN KEY ("publicationId")
    REFERENCES "PackagePricingTourPublishedVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PackagePricingTourPublishedRoomPrice_hotelRateId_fkey" FOREIGN KEY ("hotelRateId")
    REFERENCES "reservation_hotel_group_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PackagePricingTourPublishedRoomPrice_publicationId_hotelRat_key"
  ON "PackagePricingTourPublishedRoomPrice"("publicationId", "hotelRateId", "roomCode");

CREATE TRIGGER tour_pricing_publication_no_mutation BEFORE UPDATE OR DELETE
  ON "PackagePricingTourPublishedVersion" FOR EACH ROW
  EXECUTE FUNCTION finance_ticket_purchase_revision_immutable();
CREATE TRIGGER tour_pricing_room_price_no_mutation BEFORE UPDATE OR DELETE
  ON "PackagePricingTourPublishedRoomPrice" FOR EACH ROW
  EXECUTE FUNCTION finance_ticket_purchase_revision_immutable();
