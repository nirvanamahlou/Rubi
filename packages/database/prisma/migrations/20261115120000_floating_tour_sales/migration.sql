CREATE TABLE "FloatingTourSaleCatalog" (
 "packageId" UUID PRIMARY KEY REFERENCES "TourPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "branchId" UUID NOT NULL, "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" > 0),
 "payload" JSONB NOT NULL, "updatedAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE INDEX "FloatingTourSaleCatalog_branchId_idx" ON "FloatingTourSaleCatalog"("branchId");
CREATE TABLE "FloatingTourSaleImport" (
 "id" UUID PRIMARY KEY, "packageId" UUID NOT NULL REFERENCES "FloatingTourSaleCatalog"("packageId") ON DELETE RESTRICT ON UPDATE CASCADE,
 "version" INTEGER NOT NULL CHECK ("version" > 0), "actorUserId" UUID NOT NULL,
 "digest" VARCHAR(64) NOT NULL, "payload" JSONB NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "FloatingTourSaleImport_packageId_version_key" ON "FloatingTourSaleImport"("packageId", "version");
