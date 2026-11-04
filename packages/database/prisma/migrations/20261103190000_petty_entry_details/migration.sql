ALTER TABLE "procurement_petty_entries" ADD COLUMN "costCenter" VARCHAR(160), ADD COLUMN "fee" DECIMAL(24,4), ADD COLUMN "description" VARCHAR(2000);
ALTER TABLE "procurement_petty_entries" DROP CONSTRAINT "petty_registration_metadata";
ALTER TABLE "procurement_petty_entries" ADD CONSTRAINT "petty_registration_metadata" CHECK (
 (("title" IS NULL AND "occurredAt" IS NULL AND "costCenter" IS NULL AND "fee" IS NULL AND "description" IS NULL)
 OR ("title" IS NOT NULL AND "occurredAt" IS NOT NULL AND "amount" < 0 AND "requestKey" IS NULL AND "requestId" IS NULL AND ("fee" IS NULL OR ("fee" >= 0 AND "fee" <= -"amount"))))
 AND (("receiptDocumentId" IS NULL AND "receiptVersionId" IS NULL) OR ("receiptDocumentId" IS NOT NULL AND "receiptVersionId" IS NOT NULL AND ("title" IS NOT NULL OR ("amount" > 0 AND "requestId" IS NULL AND "requestKey" IS NULL))))
);
