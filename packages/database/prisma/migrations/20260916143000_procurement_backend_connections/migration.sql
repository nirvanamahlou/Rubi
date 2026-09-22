BEGIN;

CREATE TABLE "settings_procurement_approval_policies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "branchId" UUID NOT NULL,
  "unitId" VARCHAR(160) NOT NULL,
  "category" VARCHAR(160) NOT NULL,
  "currencyCode" CHAR(3) NOT NULL,
  "maximumAmount" DECIMAL(24,4) NOT NULL,
  "allowUnknownEstimate" BOOLEAN NOT NULL DEFAULT false,
  "emergencyAllowed" BOOLEAN NOT NULL DEFAULT false,
  "minimumQuotations" INTEGER NOT NULL DEFAULT 1,
  "singleSourceAllowed" BOOLEAN NOT NULL DEFAULT false,
  "steps" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "approvedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "settings_procurement_approval_policies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "settings_procurement_approval_policies_amount_check" CHECK ("maximumAmount" > 0),
  CONSTRAINT "settings_procurement_approval_policies_quotes_check" CHECK ("minimumQuotations" >= 1)
);

CREATE UNIQUE INDEX "settings_procurement_approval_policies_scope_version_key"
  ON "settings_procurement_approval_policies"("branchId", "unitId", "category", "currencyCode", "version");
CREATE INDEX "settings_procurement_approval_policies_scope_active_idx"
  ON "settings_procurement_approval_policies"("branchId", "unitId", "category", "currencyCode", "isActive");

ALTER TABLE "settings_procurement_approval_policies"
  ADD CONSTRAINT "settings_procurement_approval_policies_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "settings_procurement_approval_policies"
  ADD CONSTRAINT "settings_procurement_approval_policies_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "automation_tasks" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sourceModule" VARCHAR(80) NOT NULL,
  "sourceEventId" UUID NOT NULL,
  "sourceReference" VARCHAR(160) NOT NULL,
  "branchId" UUID NOT NULL,
  "assigneeUserId" UUID NOT NULL,
  "kind" VARCHAR(80) NOT NULL,
  "title" VARCHAR(300) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'OPEN',
  "dueAt" TIMESTAMPTZ(3),
  "payload" JSONB NOT NULL DEFAULT '{}',
  "completedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "automation_tasks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "automation_tasks_status_check" CHECK ("status" IN ('OPEN', 'COMPLETED', 'CANCELLED'))
);

CREATE UNIQUE INDEX "automation_tasks_source_event_assignee_key"
  ON "automation_tasks"("sourceModule", "sourceEventId", "assigneeUserId");
CREATE INDEX "automation_tasks_assignee_status_due_idx"
  ON "automation_tasks"("assigneeUserId", "status", "dueAt");
CREATE INDEX "automation_tasks_source_reference_status_idx"
  ON "automation_tasks"("sourceModule", "sourceReference", "status");

ALTER TABLE "automation_tasks"
  ADD CONSTRAINT "automation_tasks_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "automation_tasks"
  ADD CONSTRAINT "automation_tasks_assigneeUserId_fkey"
  FOREIGN KEY ("assigneeUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FinanceSettlementAccount already exists in the Prisma model, but no published
-- migration created it. Keep this additive and safe for databases previously
-- synchronized with `db push`.
CREATE TABLE IF NOT EXISTS "finance_settlement_accounts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "branchId" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "kind" VARCHAR(24) NOT NULL,
  "currencyCode" VARCHAR(3) NOT NULL,
  "bankId" UUID,
  "maskedIdentifier" VARCHAR(80),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_settlement_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "finance_settlement_accounts_branchId_title_currencyCode_key"
  ON "finance_settlement_accounts"("branchId", "title", "currencyCode");
CREATE INDEX IF NOT EXISTS "finance_settlement_accounts_branchId_isActive_title_idx"
  ON "finance_settlement_accounts"("branchId", "isActive", "title");
CREATE INDEX IF NOT EXISTS "finance_settlement_accounts_bankId_isActive_idx"
  ON "finance_settlement_accounts"("bankId", "isActive");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_settlement_accounts_branchId_fkey') THEN
    ALTER TABLE "finance_settlement_accounts"
      ADD CONSTRAINT "finance_settlement_accounts_branchId_fkey"
      FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_settlement_accounts_bankId_fkey') THEN
    ALTER TABLE "finance_settlement_accounts"
      ADD CONSTRAINT "finance_settlement_accounts_bankId_fkey"
      FOREIGN KEY ("bankId") REFERENCES "master_banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'finance_settlement_accounts_createdByUserId_fkey') THEN
    ALTER TABLE "finance_settlement_accounts"
      ADD CONSTRAINT "finance_settlement_accounts_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE "finance_procurement_invoice_revisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "sourceId" UUID NOT NULL,
  "sourceVersion" INTEGER NOT NULL,
  "branchId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "status" VARCHAR(40) NOT NULL,
  "accountId" UUID,
  "paymentMethodId" UUID,
  "paidAmount" DECIMAL(24,4),
  "exchangeRateToIrr" DECIMAL(24,8),
  "rialEquivalent" DECIMAL(24,4),
  "cumulativePaid" DECIMAL(24,4) NOT NULL DEFAULT 0,
  "remainingAmount" DECIMAL(24,4) NOT NULL,
  "transferAt" TIMESTAMPTZ(3),
  "paymentReference" VARCHAR(160),
  "reason" VARCHAR(500) NOT NULL DEFAULT '',
  "actorUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_procurement_invoice_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_procurement_invoice_revisions_status_check" CHECK ("status" IN ('APPROVED', 'CORRECTION_REQUIRED', 'PARTIALLY_PAID', 'PAID')),
  CONSTRAINT "finance_procurement_invoice_revisions_amounts_check" CHECK ("cumulativePaid" >= 0 AND "remainingAmount" >= 0)
);

CREATE UNIQUE INDEX "finance_procurement_invoice_revisions_source_version_key"
  ON "finance_procurement_invoice_revisions"("sourceId", "version");
CREATE INDEX "finance_procurement_invoice_revisions_branch_status_created_idx"
  ON "finance_procurement_invoice_revisions"("branchId", "status", "createdAt");
CREATE INDEX "finance_procurement_invoice_revisions_account_transfer_idx"
  ON "finance_procurement_invoice_revisions"("accountId", "transferAt");
CREATE INDEX "finance_procurement_invoice_revisions_method_transfer_idx"
  ON "finance_procurement_invoice_revisions"("paymentMethodId", "transferAt");

ALTER TABLE "finance_procurement_invoice_revisions"
  ADD CONSTRAINT "finance_procurement_invoice_revisions_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance_procurement_invoice_revisions"
  ADD CONSTRAINT "finance_procurement_invoice_revisions_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "finance_settlement_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance_procurement_invoice_revisions"
  ADD CONSTRAINT "finance_procurement_invoice_revisions_paymentMethodId_fkey"
  FOREIGN KEY ("paymentMethodId") REFERENCES "master_payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance_procurement_invoice_revisions"
  ADD CONSTRAINT "finance_procurement_invoice_revisions_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "integration_supplier_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "externalMessageId" VARCHAR(160) NOT NULL,
  "eventType" VARCHAR(120) NOT NULL,
  "orderReference" VARCHAR(160) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'RECEIVED',
  "payload" JSONB NOT NULL,
  "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMPTZ(3),
  "lastErrorCode" VARCHAR(100),
  CONSTRAINT "integration_supplier_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_supplier_messages_externalMessageId_key"
  ON "integration_supplier_messages"("externalMessageId");
CREATE INDEX "integration_supplier_messages_status_received_idx"
  ON "integration_supplier_messages"("status", "receivedAt");
CREATE INDEX "integration_supplier_messages_order_received_idx"
  ON "integration_supplier_messages"("orderReference", "receivedAt");

COMMIT;
