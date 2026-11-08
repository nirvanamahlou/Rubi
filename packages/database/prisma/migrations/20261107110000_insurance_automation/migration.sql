ALTER TABLE "reservation_insurance_policies"
  ADD COLUMN "automatic" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "sandbox" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "automation" JSONB,
  ADD COLUMN "lastError" VARCHAR(500),
  ADD COLUMN "pdfUrl" VARCHAR(2000),
  ADD COLUMN "processingUntil" TIMESTAMPTZ(3),
  ADD COLUMN "nextAttemptAt" TIMESTAMPTZ(3);
CREATE INDEX "reservation_insurance_auto_due_idx"
  ON "reservation_insurance_policies"("automatic", "status", "nextAttemptAt");
ALTER TABLE "reservation_insurance_policies"
  ADD CONSTRAINT "insurance_automatic_sandbox_check" CHECK (NOT "automatic" OR "sandbox"),
  ADD CONSTRAINT "insurance_automatic_document_check" CHECK (
    NOT "automatic" OR "status" NOT IN ('ISSUED', 'CANCELLED') OR
    ("pdfUrl" IS NOT NULL AND "pdfUrl" LIKE 'https://sandbox.travis.ir/Print/PolicyPdf/%/true'
      AND "automation" IS NOT NULL AND COALESCE("automation"->>'phase', '') = 'ISSUED')
  );
