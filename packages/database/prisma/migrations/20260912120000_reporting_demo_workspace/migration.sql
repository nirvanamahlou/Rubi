CREATE TYPE "ReportingSharingScope" AS ENUM ('PERSONAL', 'TEAM');
CREATE TYPE "ReportingRunStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "ReportingScheduleStatus" AS ENUM ('ACTIVE', 'PAUSED');
CREATE TYPE "ReportingExportFormat" AS ENUM ('CSV', 'XLSX', 'PDF');
CREATE TYPE "ReportingExportStatus" AS ENUM ('QUEUED', 'GENERATING', 'READY', 'FAILED', 'EXPIRED');

CREATE TABLE "reporting_travel_facts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "sourceItemId" VARCHAR(120) NOT NULL,
  "sourceVersion" INTEGER NOT NULL, "orderNumber" VARCHAR(80) NOT NULL,
  "occurredAt" TIMESTAMPTZ(3) NOT NULL, "legalEntityCode" VARCHAR(80) NOT NULL,
  "legalEntityName" VARCHAR(160) NOT NULL, "branchId" UUID, "branchName" VARCHAR(160) NOT NULL,
  "ownerUserId" UUID, "ownerName" VARCHAR(160) NOT NULL, "siteCode" VARCHAR(80) NOT NULL,
  "salesChannel" VARCHAR(40) NOT NULL, "serviceType" VARCHAR(40) NOT NULL,
  "customerType" VARCHAR(40) NOT NULL, "customerName" VARCHAR(160) NOT NULL,
  "agencyName" VARCHAR(160), "leadSource" VARCHAR(120), "providerName" VARCHAR(160),
  "airlineName" VARCHAR(160), "originCity" VARCHAR(120), "destinationCity" VARCHAR(120),
  "routeLabel" VARCHAR(260), "orderStatus" VARCHAR(40) NOT NULL,
  "reservationStatus" VARCHAR(40) NOT NULL, "issueStatus" VARCHAR(40) NOT NULL,
  "paymentStatus" VARCHAR(40) NOT NULL, "pnrCode" VARCHAR(40),
  "passengerCount" INTEGER NOT NULL DEFAULT 0, "segmentCount" INTEGER NOT NULL DEFAULT 0,
  "ticketCount" INTEGER NOT NULL DEFAULT 0, "currencyCode" CHAR(3) NOT NULL,
  "salesAmount" DECIMAL(24,10) NOT NULL, "purchaseAmount" DECIMAL(24,10) NOT NULL,
  "commissionAmount" DECIMAL(24,10) NOT NULL DEFAULT 0,
  "refundAmount" DECIMAL(24,10) NOT NULL DEFAULT 0,
  "settledAmount" DECIMAL(24,10) NOT NULL DEFAULT 0,
  "dataAsOf" TIMESTAMPTZ(3) NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reporting_travel_facts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "reporting_travel_facts_sourceItemId_currencyCode_key" ON "reporting_travel_facts"("sourceItemId", "currencyCode");
CREATE INDEX "reporting_travel_facts_occurredAt_legalEntityCode_currencyCode_idx" ON "reporting_travel_facts"("occurredAt", "legalEntityCode", "currencyCode");
CREATE INDEX "reporting_travel_facts_branchId_ownerUserId_occurredAt_idx" ON "reporting_travel_facts"("branchId", "ownerUserId", "occurredAt");
CREATE INDEX "reporting_travel_facts_salesChannel_serviceType_occurredAt_idx" ON "reporting_travel_facts"("salesChannel", "serviceType", "occurredAt");
CREATE INDEX "reporting_travel_facts_providerName_agencyName_occurredAt_idx" ON "reporting_travel_facts"("providerName", "agencyName", "occurredAt");

CREATE TABLE "reporting_saved_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "reportCode" VARCHAR(100) NOT NULL,
  "name" VARCHAR(200) NOT NULL, "ownerUserId" UUID NOT NULL,
  "sharingScope" "ReportingSharingScope" NOT NULL DEFAULT 'PERSONAL',
  "isFavorite" BOOLEAN NOT NULL DEFAULT false, "filterState" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "reporting_saved_reports_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reporting_saved_reports_ownerUserId_updatedAt_idx" ON "reporting_saved_reports"("ownerUserId", "updatedAt");
CREATE INDEX "reporting_saved_reports_sharingScope_updatedAt_idx" ON "reporting_saved_reports"("sharingScope", "updatedAt");

CREATE TABLE "reporting_runs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "reportCode" VARCHAR(100) NOT NULL,
  "savedReportId" UUID, "actorUserId" UUID NOT NULL, "status" "ReportingRunStatus" NOT NULL DEFAULT 'QUEUED',
  "filterSnapshot" JSONB NOT NULL, "viewName" VARCHAR(160) NOT NULL, "viewVersion" INTEGER NOT NULL,
  "recordCount" INTEGER, "durationMs" INTEGER, "errorCode" VARCHAR(100), "errorMessage" VARCHAR(500),
  "startedAt" TIMESTAMPTZ(3), "finishedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reporting_runs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reporting_runs_actorUserId_createdAt_idx" ON "reporting_runs"("actorUserId", "createdAt");
CREATE INDEX "reporting_runs_reportCode_status_createdAt_idx" ON "reporting_runs"("reportCode", "status", "createdAt");

CREATE TABLE "reporting_schedules" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "savedReportId" UUID NOT NULL, "ownerUserId" UUID NOT NULL,
  "name" VARCHAR(200) NOT NULL, "frequency" VARCHAR(20) NOT NULL, "runAtLocalTime" VARCHAR(5) NOT NULL,
  "timezone" VARCHAR(80) NOT NULL DEFAULT 'Asia/Tehran', "recipients" JSONB NOT NULL,
  "format" "ReportingExportFormat" NOT NULL, "status" "ReportingScheduleStatus" NOT NULL DEFAULT 'ACTIVE',
  "nextRunAt" TIMESTAMPTZ(3), "lastRunStatus" "ReportingRunStatus", "lastRunAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reporting_schedules_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reporting_schedules_ownerUserId_status_nextRunAt_idx" ON "reporting_schedules"("ownerUserId", "status", "nextRunAt");

CREATE TABLE "reporting_export_artifacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "runId" UUID NOT NULL, "creatorUserId" UUID NOT NULL,
  "reportCode" VARCHAR(100) NOT NULL, "reportName" VARCHAR(200) NOT NULL,
  "format" "ReportingExportFormat" NOT NULL, "status" "ReportingExportStatus" NOT NULL DEFAULT 'QUEUED',
  "fileName" VARCHAR(260) NOT NULL, "contentType" VARCHAR(120) NOT NULL, "objectKey" VARCHAR(500),
  "sizeBytes" INTEGER, "checksumSha256" CHAR(64), "filterSnapshot" JSONB NOT NULL,
  "errorMessage" VARCHAR(500), "expiresAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "reporting_export_artifacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "reporting_export_artifacts_creatorUserId_createdAt_idx" ON "reporting_export_artifacts"("creatorUserId", "createdAt");
CREATE INDEX "reporting_export_artifacts_status_expiresAt_idx" ON "reporting_export_artifacts"("status", "expiresAt");

ALTER TABLE "reporting_travel_facts" ADD CONSTRAINT "reporting_travel_facts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reporting_travel_facts" ADD CONSTRAINT "reporting_travel_facts_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "iam_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reporting_saved_reports" ADD CONSTRAINT "reporting_saved_reports_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reporting_runs" ADD CONSTRAINT "reporting_runs_savedReportId_fkey" FOREIGN KEY ("savedReportId") REFERENCES "reporting_saved_reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reporting_runs" ADD CONSTRAINT "reporting_runs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reporting_schedules" ADD CONSTRAINT "reporting_schedules_savedReportId_fkey" FOREIGN KEY ("savedReportId") REFERENCES "reporting_saved_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reporting_schedules" ADD CONSTRAINT "reporting_schedules_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reporting_export_artifacts" ADD CONSTRAINT "reporting_export_artifacts_runId_fkey" FOREIGN KEY ("runId") REFERENCES "reporting_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reporting_export_artifacts" ADD CONSTRAINT "reporting_export_artifacts_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
