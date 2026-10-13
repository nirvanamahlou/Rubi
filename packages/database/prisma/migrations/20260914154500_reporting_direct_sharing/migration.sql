CREATE TABLE "reporting_saved_report_shares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "savedReportId" UUID NOT NULL,
    "recipientUserId" UUID NOT NULL,
    "sharedByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reporting_saved_report_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "reporting_saved_report_shares_savedReportId_recipientUserId_key"
ON "reporting_saved_report_shares"("savedReportId", "recipientUserId");

CREATE INDEX "reporting_saved_report_shares_recipientUserId_updatedAt_idx"
ON "reporting_saved_report_shares"("recipientUserId", "updatedAt");

CREATE INDEX "reporting_saved_report_shares_sharedByUserId_updatedAt_idx"
ON "reporting_saved_report_shares"("sharedByUserId", "updatedAt");

ALTER TABLE "reporting_saved_report_shares"
ADD CONSTRAINT "reporting_saved_report_shares_savedReportId_fkey"
FOREIGN KEY ("savedReportId") REFERENCES "reporting_saved_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reporting_saved_report_shares"
ADD CONSTRAINT "reporting_saved_report_shares_recipientUserId_fkey"
FOREIGN KEY ("recipientUserId") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "reporting_saved_report_shares"
ADD CONSTRAINT "reporting_saved_report_shares_sharedByUserId_fkey"
FOREIGN KEY ("sharedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
