-- Additive accounting FX snapshot and Finance-owned references only.

ALTER TABLE "accounting_journal_lines" ADD COLUMN     "fxSnapshotId" UUID;

CREATE TABLE "accounting_fx_snapshots" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "rate" DECIMAL(38,18) NOT NULL,
    "source" VARCHAR(160) NOT NULL,
    "validFrom" TIMESTAMPTZ(3) NOT NULL,
    "validTo" TIMESTAMPTZ(3) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    "makerId" UUID NOT NULL,
    "approverId" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "accounting_fx_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "accounting_fx_snapshots_bookId_currency_status_idx" ON "accounting_fx_snapshots"("bookId", "currency", "status");

ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_fxSnapshotId_fkey" FOREIGN KEY ("fxSnapshotId") REFERENCES "accounting_fx_snapshots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_fx_snapshots" ADD CONSTRAINT "accounting_fx_snapshots_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_fx_snapshots" ADD CONSTRAINT "accounting_fx_snapshots_makerId_fkey" FOREIGN KEY ("makerId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_fx_snapshots" ADD CONSTRAINT "accounting_fx_snapshots_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
