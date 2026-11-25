CREATE TABLE "PackagePricingCharterExcelVersion" (
    "id" UUID NOT NULL,
    "tourDepartureId" UUID NOT NULL,
    "tourVersion" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "rows" JSONB NOT NULL,
    "publishedByUserId" UUID NOT NULL,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PackagePricingCharterExcelVersion_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PackagePricingCharterExcelVersion_tourDepartureId_fkey"
      FOREIGN KEY ("tourDepartureId") REFERENCES "TourDeparture"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PackagePricingCharterExcelVersion_publishedByUserId_fkey"
      FOREIGN KEY ("publishedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PackagePricingCharterExcelVersion_tourDepartureId_version_key"
    ON "PackagePricingCharterExcelVersion"("tourDepartureId", "version");
