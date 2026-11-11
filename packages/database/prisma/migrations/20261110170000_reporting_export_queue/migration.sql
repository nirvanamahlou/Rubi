ALTER TABLE "reporting_export_artifacts"
  ADD COLUMN "queuePayload" JSONB,
  ADD COLUMN "queueToken" UUID,
  ADD COLUMN "queueLeaseUntil" TIMESTAMPTZ(3),
  ADD COLUMN "queueAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "reporting_export_queue_idx"
  ON "reporting_export_artifacts" ("status", "queueLeaseUntil", "createdAt");
