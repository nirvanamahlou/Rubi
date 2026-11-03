ALTER TABLE "procurement_petty_entries"
  ADD COLUMN "title" VARCHAR(240),
  ADD COLUMN "occurredAt" TIMESTAMPTZ(3),
  ADD COLUMN "receiptDocumentId" UUID REFERENCES "documents"("id") ON DELETE RESTRICT,
  ADD COLUMN "receiptVersionId" UUID REFERENCES "document_versions"("id") ON DELETE RESTRICT;
ALTER TABLE "procurement_petty_entries" ADD CONSTRAINT "petty_registration_metadata" CHECK (
  ("title" IS NULL AND "occurredAt" IS NULL AND "receiptDocumentId" IS NULL AND "receiptVersionId" IS NULL)
  OR ("title" IS NOT NULL AND "occurredAt" IS NOT NULL AND "amount" < 0 AND "requestKey" IS NULL AND "requestId" IS NULL AND
    (("receiptDocumentId" IS NULL AND "receiptVersionId" IS NULL) OR ("receiptDocumentId" IS NOT NULL AND "receiptVersionId" IS NOT NULL)))
);
CREATE INDEX "petty_registration_date_idx" ON "procurement_petty_entries" ("fundId", "occurredAt") WHERE "title" IS NOT NULL;
