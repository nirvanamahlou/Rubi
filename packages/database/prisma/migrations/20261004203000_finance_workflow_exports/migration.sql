-- CreateTable
CREATE TABLE "finance_operational_requests" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "party" VARCHAR(200) NOT NULL,
    "description" VARCHAR(2000) NOT NULL,
    "reference" VARCHAR(160) NOT NULL,
    "amount" DECIMAL(24,4) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "dueAt" TIMESTAMPTZ(3) NOT NULL,
    "status" VARCHAR(24) NOT NULL DEFAULT 'NEW',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createFingerprint" VARCHAR(64) NOT NULL,
    "hrRecordId" UUID,
    "payrollEmployeeId" UUID,
    "payrollPeriod" VARCHAR(20),
    "sourceVersion" INTEGER,
    "refundReceiptId" UUID,
    "documentId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "finance_operational_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_operational_revisions" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "action" VARCHAR(24) NOT NULL,
    "fromStatus" VARCHAR(24),
    "toStatus" VARCHAR(24) NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "snapshot" JSONB NOT NULL,
    "paidAmount" DECIMAL(24,4),
    "cumulativePaid" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(24,4) NOT NULL,
    "accountId" UUID,
    "methodId" UUID,
    "transferAt" TIMESTAMPTZ(3),
    "paymentReference" VARCHAR(160),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_operational_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_saved_views" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" VARCHAR(80) NOT NULL,
    "query" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_saved_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_reminder_policies" (
    "branchId" UUID NOT NULL,
    "managerId" UUID NOT NULL,
    "updatedById" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "finance_reminder_policies_pkey" PRIMARY KEY ("branchId")
);

-- CreateTable
CREATE TABLE "finance_reminder_deliveries" (
    "id" UUID NOT NULL,
    "requestId" UUID,
    "sourceKey" VARCHAR(160) NOT NULL,
    "phase" VARCHAR(16) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_reminder_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_operational_requests_hrRecordId_key" ON "finance_operational_requests"("hrRecordId");

-- CreateIndex
CREATE INDEX "finance_operational_requests_branchId_status_dueAt_idx" ON "finance_operational_requests"("branchId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "finance_operational_requests_refundReceiptId_status_idx" ON "finance_operational_requests"("refundReceiptId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "finance_operational_requests_payrollEmployeeId_payrollPerio_key" ON "finance_operational_requests"("payrollEmployeeId", "payrollPeriod");

-- CreateIndex
CREATE INDEX "finance_operational_revisions_requestId_transferAt_idx" ON "finance_operational_revisions"("requestId", "transferAt");

-- CreateIndex
CREATE UNIQUE INDEX "finance_operational_revisions_requestId_version_key" ON "finance_operational_revisions"("requestId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "finance_saved_views_ownerId_title_key" ON "finance_saved_views"("ownerId", "title");

-- CreateIndex
CREATE INDEX "finance_reminder_deliveries_requestId_phase_idx" ON "finance_reminder_deliveries"("requestId", "phase");
CREATE UNIQUE INDEX "finance_reminder_deliveries_sourceKey_phase_key" ON "finance_reminder_deliveries"("sourceKey", "phase");

-- AddForeignKey
ALTER TABLE "finance_operational_requests" ADD CONSTRAINT "finance_operational_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_operational_requests" ADD CONSTRAINT "finance_operational_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_operational_requests" ADD CONSTRAINT "finance_operational_requests_hrRecordId_fkey" FOREIGN KEY ("hrRecordId") REFERENCES "hr_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_operational_requests" ADD CONSTRAINT "finance_operational_requests_payrollEmployeeId_fkey" FOREIGN KEY ("payrollEmployeeId") REFERENCES "hr_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_operational_requests" ADD CONSTRAINT "finance_operational_requests_refundReceiptId_fkey" FOREIGN KEY ("refundReceiptId") REFERENCES "sales_contract_payment_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_operational_requests" ADD CONSTRAINT "finance_operational_requests_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_operational_revisions" ADD CONSTRAINT "finance_operational_revisions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "finance_operational_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_operational_revisions" ADD CONSTRAINT "finance_operational_revisions_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_operational_revisions" ADD CONSTRAINT "finance_operational_revisions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceSettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_operational_revisions" ADD CONSTRAINT "finance_operational_revisions_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "master_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_saved_views" ADD CONSTRAINT "finance_saved_views_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_reminder_policies" ADD CONSTRAINT "finance_reminder_policies_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_reminder_policies" ADD CONSTRAINT "finance_reminder_policies_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_reminder_policies" ADD CONSTRAINT "finance_reminder_policies_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_reminder_deliveries" ADD CONSTRAINT "finance_reminder_deliveries_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "finance_operational_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Catalog only. Administrators explicitly assign export and request-management permissions.
INSERT INTO "iam_permissions" ("id", "code", "module", "name") VALUES
('031917b4-2ad2-4bc9-ae84-af11fd6946c0', 'finance.export', 'finance', 'خروجی و رسید مالی'),
('031917b4-2ad2-4bc9-ae84-af11fd6946c1', 'finance.request.manage', 'finance', 'بررسی درخواست مالی')
ON CONFLICT ("code") DO NOTHING;

ALTER TABLE "finance_operational_requests"
ADD CONSTRAINT "finance_request_positive_amount" CHECK ("amount" > 0),
ADD CONSTRAINT "finance_request_currency" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
ADD CONSTRAINT "finance_request_version" CHECK ("version" >= 1),
ADD CONSTRAINT "finance_request_status" CHECK ("status" IN ('NEW','UNDER_REVIEW','CORRECTION_REQUIRED','APPROVED','PAYING','PAID','REJECTED','CANCELLED')),
ADD CONSTRAINT "finance_payroll_source" CHECK ("kind" <> 'PAYROLL' OR ("hrRecordId" IS NOT NULL AND "payrollEmployeeId" IS NOT NULL AND "payrollPeriod" IS NOT NULL AND "sourceVersion" >= 1));
ALTER TABLE "finance_operational_revisions"
ADD CONSTRAINT "finance_revision_amounts" CHECK ("cumulativePaid" >= 0 AND "remainingAmount" >= 0),
ADD CONSTRAINT "finance_revision_payment" CHECK (("action" = 'PAY' AND "paidAmount" > 0 AND "accountId" IS NOT NULL AND "methodId" IS NOT NULL AND "transferAt" IS NOT NULL) OR ("action" <> 'PAY' AND "paidAmount" IS NULL));
CREATE FUNCTION finance_revision_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Finance operational history is append-only' USING ERRCODE = '23514'; END;
$$;
CREATE TRIGGER finance_revision_append_only BEFORE UPDATE OR DELETE ON "finance_operational_revisions"
FOR EACH ROW EXECUTE FUNCTION finance_revision_append_only();

-- HR-owned approved salary inputs are immutable. Corrections require a separate domain workflow.
CREATE FUNCTION hr_approved_salary_input_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.section = 'payroll' AND OLD.tab = 'paymentRequests' AND OLD.status IN ('تأییدشده','تاییدشده') THEN
  RAISE EXCEPTION 'Approved salary payment inputs cannot be rewritten' USING ERRCODE = '23514';
 END IF;
 IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER hr_approved_salary_input_immutable BEFORE UPDATE OR DELETE ON "hr_records"
FOR EACH ROW EXECUTE FUNCTION hr_approved_salary_input_immutable();
