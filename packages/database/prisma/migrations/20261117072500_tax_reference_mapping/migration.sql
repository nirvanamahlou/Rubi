-- One current official list per ledger and dimension. A mapping has exactly one Nora source.
-- CreateEnum
CREATE TYPE "TaxReferenceKind" AS ENUM ('CURRENCY', 'REGION');

-- CreateTable
CREATE TABLE "tax_reference_releases" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "kind" "TaxReferenceKind" NOT NULL,
    "label" VARCHAR(80) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importedById" UUID NOT NULL,

    CONSTRAINT "tax_reference_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_reference_entries" (
    "id" UUID NOT NULL,
    "releaseId" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200) NOT NULL,

    CONSTRAINT "tax_reference_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tax_reference_mappings" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "currencyId" UUID,
    "regionId" UUID,
    "entryId" UUID NOT NULL,

    CONSTRAINT "tax_reference_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasonal_journal_regions" (
    "journalId" UUID NOT NULL,
    "regionId" UUID NOT NULL,

    CONSTRAINT "seasonal_journal_regions_pkey" PRIMARY KEY ("journalId")
);

-- CreateTable
CREATE TABLE "seasonal_report_snapshots" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "dateFrom" VARCHAR(10) NOT NULL,
    "dateTo" VARCHAR(10) NOT NULL,
    "layout" VARCHAR(20) NOT NULL,
    "digest" CHAR(64) NOT NULL,
    "rows" JSONB NOT NULL,
    "approvedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedById" UUID NOT NULL,

    CONSTRAINT "seasonal_report_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tax_reference_releases_bookId_kind_label_key" ON "tax_reference_releases"("bookId", "kind", "label");

-- CreateIndex
CREATE UNIQUE INDEX "tax_reference_entries_releaseId_code_key" ON "tax_reference_entries"("releaseId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tax_reference_mappings_bookId_currencyId_key" ON "tax_reference_mappings"("bookId", "currencyId");

-- CreateIndex
CREATE UNIQUE INDEX "tax_reference_mappings_bookId_regionId_key" ON "tax_reference_mappings"("bookId", "regionId");

-- CreateIndex
CREATE UNIQUE INDEX "seasonal_report_snapshots_bookId_periodId_dateFrom_dateTo_l_key" ON "seasonal_report_snapshots"("bookId", "periodId", "dateFrom", "dateTo", "layout", "digest");

CREATE UNIQUE INDEX "tax_reference_current" ON "tax_reference_releases" ("bookId", "kind") WHERE active;
ALTER TABLE "tax_reference_mappings" ADD CONSTRAINT "tax_reference_one_source" CHECK (num_nonnulls("regionId", "currencyId") = 1);

-- AddForeignKey
ALTER TABLE "tax_reference_releases" ADD CONSTRAINT "tax_reference_releases_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_reference_releases" ADD CONSTRAINT "tax_reference_releases_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_reference_entries" ADD CONSTRAINT "tax_reference_entries_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "tax_reference_releases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_reference_mappings" ADD CONSTRAINT "tax_reference_mappings_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_reference_mappings" ADD CONSTRAINT "tax_reference_mappings_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "master_currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_reference_mappings" ADD CONSTRAINT "tax_reference_mappings_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "master_regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tax_reference_mappings" ADD CONSTRAINT "tax_reference_mappings_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "tax_reference_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasonal_journal_regions" ADD CONSTRAINT "seasonal_journal_regions_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "accounting_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasonal_journal_regions" ADD CONSTRAINT "seasonal_journal_regions_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "master_regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasonal_report_snapshots" ADD CONSTRAINT "seasonal_report_snapshots_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasonal_report_snapshots" ADD CONSTRAINT "seasonal_report_snapshots_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasonal_report_snapshots" ADD CONSTRAINT "seasonal_report_snapshots_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
