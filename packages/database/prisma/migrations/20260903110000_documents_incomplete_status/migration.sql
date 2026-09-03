-- DOCUMENTS-004: additive incomplete-document status for operational follow-up.

ALTER TABLE "documents"
ADD COLUMN "is_incomplete" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "documents_is_incomplete_archive_status_updated_at_idx"
ON "documents"("is_incomplete", "archive_status", "updated_at");
