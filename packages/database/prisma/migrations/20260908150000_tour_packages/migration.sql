CREATE TABLE "TourPackage" (
  "id" UUID NOT NULL, "version" INTEGER NOT NULL DEFAULT 1,
  "branchId" UUID NOT NULL, "name" VARCHAR(160) NOT NULL, "definition" JSONB NOT NULL,
  "createdByUserId" UUID NOT NULL, "createKey" VARCHAR(160) NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourPackage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TourPackage_createdByUserId_createKey_key" ON "TourPackage"("createdByUserId", "createKey");
CREATE INDEX "TourPackage_branchId_createdAt_idx" ON "TourPackage"("branchId", "createdAt");
CREATE TABLE "TourDeparture" (
  "id" UUID NOT NULL, "version" INTEGER NOT NULL DEFAULT 1, "branchId" UUID NOT NULL,
  "packageId" UUID NOT NULL, "packageVersion" INTEGER NOT NULL,
  "startsOn" DATE NOT NULL, "endsOn" DATE NOT NULL,
  "outboundOfferId" UUID NOT NULL, "returnOfferId" UUID,
  "createdByUserId" UUID NOT NULL, "createKey" VARCHAR(160) NOT NULL,
  "fingerprint" VARCHAR(64) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TourDeparture_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TourDeparture_dates_check" CHECK ("endsOn" >= "startsOn"),
  CONSTRAINT "TourDeparture_distinct_offers_check" CHECK ("returnOfferId" IS NULL OR "returnOfferId" <> "outboundOfferId"),
  CONSTRAINT "TourDeparture_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "TourPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TourDeparture_outboundOfferId_fkey" FOREIGN KEY ("outboundOfferId") REFERENCES "TicketPublishedOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TourDeparture_returnOfferId_fkey" FOREIGN KEY ("returnOfferId") REFERENCES "TicketPublishedOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TourDeparture_createdByUserId_createKey_key" ON "TourDeparture"("createdByUserId", "createKey");
CREATE INDEX "TourDeparture_branchId_startsOn_idx" ON "TourDeparture"("branchId", "startsOn");
CREATE INDEX "TourDeparture_packageId_idx" ON "TourDeparture"("packageId");
