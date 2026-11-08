CREATE TABLE "reservation_note_mail" (
  "id" UUID PRIMARY KEY,
  "revisionId" UUID NOT NULL UNIQUE REFERENCES "ReservationWorkflowRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "contactId" UUID NOT NULL REFERENCES "master_organization_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "envelope" TEXT NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0 CHECK ("attempts" BETWEEN 0 AND 5),
  "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reservation_note_mail_status" CHECK ("status" IN ('QUEUED','SENDING','RETRY','ACCEPTED','FAILED','UNKNOWN'))
);
CREATE INDEX "reservation_note_mail_status_nextAttemptAt_idx" ON "reservation_note_mail"("status", "nextAttemptAt");
