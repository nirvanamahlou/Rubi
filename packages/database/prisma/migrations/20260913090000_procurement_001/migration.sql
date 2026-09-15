-- PROCUREMENT-001: additive only; no backfill, grants, owner policy or Finance liability.
-- CreateTable
CREATE TABLE "procurement_request" (
    "id" UUID NOT NULL,
    "number" VARCHAR(60) NOT NULL,
    "branchId" UUID NOT NULL,
    "requesterUserId" UUID NOT NULL,
    "unitId" VARCHAR(160),
    "ownerUserId" UUID,
    "status" VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(300) NOT NULL DEFAULT '',
    "category" VARCHAR(80),
    "priority" VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "requiredAt" TIMESTAMPTZ(3),
    "estimatedAmount" DECIMAL(24,4),
    "currencyCode" CHAR(3),
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "procurement_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_request_item" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "kind" VARCHAR(30) NOT NULL DEFAULT 'GOODS',
    "description" TEXT NOT NULL DEFAULT '',
    "quantity" DECIMAL(24,4),
    "unit" VARCHAR(80),
    "acceptanceCriteria" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "procurement_request_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_request_version" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_request_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_approval_snapshot" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "requestVersionId" UUID NOT NULL,
    "policyReference" VARCHAR(160) NOT NULL,
    "policyVersion" VARCHAR(80) NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_approval_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_approval_step" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "approverUserId" UUID NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "procurement_approval_step_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_approval_decision" (
    "id" UUID NOT NULL,
    "stepId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "decision" VARCHAR(40) NOT NULL,
    "reason" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_approval_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_quotation" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "reference" VARCHAR(120),
    "currencyCode" CHAR(3) NOT NULL,
    "totalAmount" DECIMAL(24,4) NOT NULL,
    "validUntil" TIMESTAMPTZ(3),
    "status" VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "procurement_quotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_quotation_item" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "quotationId" UUID NOT NULL,
    "requestItemId" UUID NOT NULL,
    "quantity" DECIMAL(24,4) NOT NULL,
    "unitPrice" DECIMAL(24,4) NOT NULL,
    "taxAmount" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(24,4) NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extraCostAmount" DECIMAL(24,4) NOT NULL DEFAULT 0,

    CONSTRAINT "procurement_quotation_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_selection" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "quotationId" UUID NOT NULL,
    "requestVersionId" UUID NOT NULL,
    "selectedByUserId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_selection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_order" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "number" VARCHAR(60) NOT NULL,
    "supplierId" UUID NOT NULL,
    "selectionId" UUID,
    "status" VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currencyCode" CHAR(3) NOT NULL,
    "totalAmount" DECIMAL(24,4) NOT NULL,
    "expectedAt" TIMESTAMPTZ(3),
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "procurement_order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_order_version" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "payload" JSONB NOT NULL,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_order_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_order_item" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "requestItemId" UUID NOT NULL,
    "quantity" DECIMAL(24,4) NOT NULL,
    "unitPrice" DECIMAL(24,4) NOT NULL,
    "taxAmount" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(24,4) NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extraCostAmount" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "orderVersionId" UUID NOT NULL,

    CONSTRAINT "procurement_order_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_receipt" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderVersionId" UUID NOT NULL,
    "number" VARCHAR(60) NOT NULL,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL,
    "receivedByUserId" UUID NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_receipt_item" (
    "id" UUID NOT NULL,
    "receiptId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "quantity" DECIMAL(24,4) NOT NULL,
    "acceptedQuantity" DECIMAL(24,4) NOT NULL,
    "rejectedQuantity" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderVersionId" UUID NOT NULL,

    CONSTRAINT "procurement_receipt_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_service_acceptance" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "acceptedByUserId" UUID NOT NULL,
    "acceptedAt" TIMESTAMPTZ(3) NOT NULL,
    "quantity" DECIMAL(24,4) NOT NULL,
    "criteriaSnapshot" JSONB NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderVersionId" UUID NOT NULL,

    CONSTRAINT "procurement_service_acceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_discrepancy" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "receiptId" UUID,
    "kind" VARCHAR(50) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "procurement_discrepancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_return" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "receiptItemId" UUID NOT NULL,
    "quantity" DECIMAL(24,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "returnedByUserId" UUID NOT NULL,
    "returnedAt" TIMESTAMPTZ(3) NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_invoice" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "number" VARCHAR(120) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "currencyCode" CHAR(3) NOT NULL,
    "totalAmount" DECIMAL(24,4) NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "dueAt" TIMESTAMPTZ(3),
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "normalizedNumber" VARCHAR(120) NOT NULL,
    "issuerLegalEntityId" UUID NOT NULL,
    "orderVersionId" UUID NOT NULL,

    CONSTRAINT "procurement_invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_invoice_item" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderItemId" UUID NOT NULL,
    "quantity" DECIMAL(24,4) NOT NULL,
    "unitPrice" DECIMAL(24,4) NOT NULL,
    "taxAmount" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(24,4) NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extraCostAmount" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "orderVersionId" UUID NOT NULL,

    CONSTRAINT "procurement_invoice_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_invoice_match" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "invoiceVersion" INTEGER NOT NULL,
    "orderId" UUID NOT NULL,
    "orderVersionId" UUID NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "matchedByUserId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_invoice_match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_finance_handoff" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "invoiceVersion" INTEGER NOT NULL,
    "sourceKey" VARCHAR(160) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 1,
    "acceptedSourceId" VARCHAR(160),
    "payload" JSONB NOT NULL,
    "lastErrorCode" VARCHAR(100),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "procurement_finance_handoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_outbox" (
    "id" UUID NOT NULL,
    "handoffId" UUID,
    "eventId" UUID NOT NULL,
    "eventType" VARCHAR(120) NOT NULL,
    "status" VARCHAR(40) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMPTZ(3),
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "requestId" UUID NOT NULL,

    CONSTRAINT "procurement_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_idempotency" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "operation" VARCHAR(100) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "response" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_idempotency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_audit" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" UUID NOT NULL,
    "reason" TEXT,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "procurement_request_number_key" ON "procurement_request"("number");

-- CreateIndex
CREATE INDEX "procurement_request_requesterUserId_idx" ON "procurement_request"("requesterUserId");

-- CreateIndex
CREATE INDEX "procurement_request_ownerUserId_idx" ON "procurement_request"("ownerUserId");

-- CreateIndex
CREATE INDEX "procurement_request_currencyCode_idx" ON "procurement_request"("currencyCode");

-- CreateIndex
CREATE INDEX "procurement_request_branchId_status_createdAt_id_idx" ON "procurement_request"("branchId", "status", "createdAt", "id");

-- CreateIndex
CREATE INDEX "procurement_request_branchId_requesterUserId_createdAt_id_idx" ON "procurement_request"("branchId", "requesterUserId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "procurement_request_branchId_ownerUserId_createdAt_id_idx" ON "procurement_request"("branchId", "ownerUserId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "procurement_request_branchId_requiredAt_idx" ON "procurement_request"("branchId", "requiredAt");

-- CreateIndex
CREATE INDEX "procurement_request_item_requestId_idx" ON "procurement_request_item"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_request_item_id_requestId_key" ON "procurement_request_item"("id", "requestId");

-- CreateIndex
CREATE INDEX "procurement_request_version_createdByUserId_idx" ON "procurement_request_version"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_request_version_id_requestId_key" ON "procurement_request_version"("id", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_request_version_requestId_version_key" ON "procurement_request_version"("requestId", "version");

-- CreateIndex
CREATE INDEX "procurement_approval_snapshot_requestId_idx" ON "procurement_approval_snapshot"("requestId");

-- CreateIndex
CREATE INDEX "procurement_approval_snapshot_requestVersionId_requestId_idx" ON "procurement_approval_snapshot"("requestVersionId", "requestId");

-- CreateIndex
CREATE INDEX "procurement_approval_step_approverUserId_idx" ON "procurement_approval_step"("approverUserId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_approval_step_snapshotId_position_key" ON "procurement_approval_step"("snapshotId", "position");

-- CreateIndex
CREATE INDEX "procurement_approval_decision_actorUserId_idx" ON "procurement_approval_decision"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_approval_decision_stepId_key" ON "procurement_approval_decision"("stepId");

-- CreateIndex
CREATE INDEX "procurement_quotation_requestId_idx" ON "procurement_quotation"("requestId");

-- CreateIndex
CREATE INDEX "procurement_quotation_supplierId_idx" ON "procurement_quotation"("supplierId");

-- CreateIndex
CREATE INDEX "procurement_quotation_currencyCode_idx" ON "procurement_quotation"("currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_quotation_id_requestId_key" ON "procurement_quotation"("id", "requestId");

-- CreateIndex
CREATE INDEX "procurement_quotation_item_quotationId_requestId_idx" ON "procurement_quotation_item"("quotationId", "requestId");

-- CreateIndex
CREATE INDEX "procurement_quotation_item_requestItemId_requestId_idx" ON "procurement_quotation_item"("requestItemId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_quotation_item_quotationId_requestItemId_key" ON "procurement_quotation_item"("quotationId", "requestItemId");

-- CreateIndex
CREATE INDEX "procurement_selection_requestId_idx" ON "procurement_selection"("requestId");

-- CreateIndex
CREATE INDEX "procurement_selection_quotationId_requestId_idx" ON "procurement_selection"("quotationId", "requestId");

-- CreateIndex
CREATE INDEX "procurement_selection_requestVersionId_requestId_idx" ON "procurement_selection"("requestVersionId", "requestId");

-- CreateIndex
CREATE INDEX "procurement_selection_selectedByUserId_idx" ON "procurement_selection"("selectedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_selection_id_requestId_key" ON "procurement_selection"("id", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_order_number_key" ON "procurement_order"("number");

-- CreateIndex
CREATE INDEX "procurement_order_requestId_idx" ON "procurement_order"("requestId");

-- CreateIndex
CREATE INDEX "procurement_order_supplierId_idx" ON "procurement_order"("supplierId");

-- CreateIndex
CREATE INDEX "procurement_order_currencyCode_idx" ON "procurement_order"("currencyCode");

-- CreateIndex
CREATE INDEX "procurement_order_selectionId_requestId_idx" ON "procurement_order"("selectionId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_order_id_requestId_key" ON "procurement_order"("id", "requestId");

-- CreateIndex
CREATE INDEX "procurement_order_version_createdByUserId_idx" ON "procurement_order_version"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_order_version_id_orderId_key" ON "procurement_order_version"("id", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_order_version_orderId_version_key" ON "procurement_order_version"("orderId", "version");

-- CreateIndex
CREATE INDEX "procurement_order_item_orderId_requestId_idx" ON "procurement_order_item"("orderId", "requestId");

-- CreateIndex
CREATE INDEX "procurement_order_item_requestItemId_requestId_idx" ON "procurement_order_item"("requestItemId", "requestId");

-- CreateIndex
CREATE INDEX "procurement_order_item_orderVersionId_orderId_idx" ON "procurement_order_item"("orderVersionId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_order_item_id_orderId_key" ON "procurement_order_item"("id", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_order_item_orderVersionId_requestItemId_key" ON "procurement_order_item"("orderVersionId", "requestItemId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_order_item_id_orderId_orderVersionId_key" ON "procurement_order_item"("id", "orderId", "orderVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_receipt_number_key" ON "procurement_receipt"("number");

-- CreateIndex
CREATE INDEX "procurement_receipt_requestId_idx" ON "procurement_receipt"("requestId");

-- CreateIndex
CREATE INDEX "procurement_receipt_orderId_requestId_idx" ON "procurement_receipt"("orderId", "requestId");

-- CreateIndex
CREATE INDEX "procurement_receipt_orderVersionId_orderId_idx" ON "procurement_receipt"("orderVersionId", "orderId");

-- CreateIndex
CREATE INDEX "procurement_receipt_receivedByUserId_idx" ON "procurement_receipt"("receivedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_receipt_id_orderId_key" ON "procurement_receipt"("id", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_receipt_id_orderId_orderVersionId_key" ON "procurement_receipt"("id", "orderId", "orderVersionId");

-- CreateIndex
CREATE INDEX "procurement_receipt_item_receiptId_orderId_orderVersionId_idx" ON "procurement_receipt_item"("receiptId", "orderId", "orderVersionId");

-- CreateIndex
CREATE INDEX "procurement_receipt_item_orderItemId_orderId_orderVersionId_idx" ON "procurement_receipt_item"("orderItemId", "orderId", "orderVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_receipt_item_id_orderId_key" ON "procurement_receipt_item"("id", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_receipt_item_receiptId_orderItemId_key" ON "procurement_receipt_item"("receiptId", "orderItemId");

-- CreateIndex
CREATE INDEX "procurement_service_acceptance_requestId_idx" ON "procurement_service_acceptance"("requestId");

-- CreateIndex
CREATE INDEX "procurement_service_acceptance_orderId_requestId_idx" ON "procurement_service_acceptance"("orderId", "requestId");

-- CreateIndex
CREATE INDEX "procurement_service_acceptance_acceptedByUserId_idx" ON "procurement_service_acceptance"("acceptedByUserId");

-- CreateIndex
CREATE INDEX "procurement_service_acceptance_orderVersionId_orderId_idx" ON "procurement_service_acceptance"("orderVersionId", "orderId");

-- CreateIndex
CREATE INDEX "procurement_service_acceptance_orderItemId_orderId_orderVer_idx" ON "procurement_service_acceptance"("orderItemId", "orderId", "orderVersionId");

-- CreateIndex
CREATE INDEX "procurement_discrepancy_requestId_idx" ON "procurement_discrepancy"("requestId");

-- CreateIndex
CREATE INDEX "procurement_discrepancy_orderId_requestId_idx" ON "procurement_discrepancy"("orderId", "requestId");

-- CreateIndex
CREATE INDEX "procurement_discrepancy_receiptId_orderId_idx" ON "procurement_discrepancy"("receiptId", "orderId");

-- CreateIndex
CREATE INDEX "procurement_return_requestId_idx" ON "procurement_return"("requestId");

-- CreateIndex
CREATE INDEX "procurement_return_orderId_requestId_idx" ON "procurement_return"("orderId", "requestId");

-- CreateIndex
CREATE INDEX "procurement_return_receiptItemId_orderId_idx" ON "procurement_return"("receiptItemId", "orderId");

-- CreateIndex
CREATE INDEX "procurement_return_returnedByUserId_idx" ON "procurement_return"("returnedByUserId");

-- CreateIndex
CREATE INDEX "procurement_invoice_requestId_idx" ON "procurement_invoice"("requestId");

-- CreateIndex
CREATE INDEX "procurement_invoice_currencyCode_idx" ON "procurement_invoice"("currencyCode");

-- CreateIndex
CREATE INDEX "procurement_invoice_orderId_requestId_idx" ON "procurement_invoice"("orderId", "requestId");

-- CreateIndex
CREATE INDEX "procurement_invoice_issuerLegalEntityId_idx" ON "procurement_invoice"("issuerLegalEntityId");

-- CreateIndex
CREATE INDEX "procurement_invoice_orderVersionId_orderId_idx" ON "procurement_invoice"("orderVersionId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_invoice_id_orderId_key" ON "procurement_invoice"("id", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_invoice_supplierId_issuerLegalEntityId_normaliz_key" ON "procurement_invoice"("supplierId", "issuerLegalEntityId", "normalizedNumber");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_invoice_id_requestId_key" ON "procurement_invoice"("id", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_invoice_id_orderId_orderVersionId_key" ON "procurement_invoice"("id", "orderId", "orderVersionId");

-- CreateIndex
CREATE INDEX "procurement_invoice_item_invoiceId_orderId_orderVersionId_idx" ON "procurement_invoice_item"("invoiceId", "orderId", "orderVersionId");

-- CreateIndex
CREATE INDEX "procurement_invoice_item_orderItemId_orderId_orderVersionId_idx" ON "procurement_invoice_item"("orderItemId", "orderId", "orderVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_invoice_item_invoiceId_orderItemId_key" ON "procurement_invoice_item"("invoiceId", "orderItemId");

-- CreateIndex
CREATE INDEX "procurement_invoice_match_invoiceId_orderId_idx" ON "procurement_invoice_match"("invoiceId", "orderId");

-- CreateIndex
CREATE INDEX "procurement_invoice_match_orderVersionId_orderId_idx" ON "procurement_invoice_match"("orderVersionId", "orderId");

-- CreateIndex
CREATE INDEX "procurement_invoice_match_matchedByUserId_idx" ON "procurement_invoice_match"("matchedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_finance_handoff_sourceKey_key" ON "procurement_finance_handoff"("sourceKey");

-- CreateIndex
CREATE INDEX "procurement_finance_handoff_requestId_idx" ON "procurement_finance_handoff"("requestId");

-- CreateIndex
CREATE INDEX "procurement_finance_handoff_invoiceId_requestId_idx" ON "procurement_finance_handoff"("invoiceId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_finance_handoff_invoiceId_invoiceVersion_key" ON "procurement_finance_handoff"("invoiceId", "invoiceVersion");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_outbox_eventId_key" ON "procurement_outbox"("eventId");

-- CreateIndex
CREATE INDEX "procurement_outbox_requestId_idx" ON "procurement_outbox"("requestId");

-- CreateIndex
CREATE INDEX "procurement_outbox_handoffId_idx" ON "procurement_outbox"("handoffId");

-- CreateIndex
CREATE INDEX "procurement_outbox_status_availableAt_idx" ON "procurement_outbox"("status", "availableAt");

-- CreateIndex
CREATE INDEX "procurement_idempotency_branchId_idx" ON "procurement_idempotency"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_idempotency_actorUserId_branchId_operation_key_key" ON "procurement_idempotency"("actorUserId", "branchId", "operation", "key");

-- CreateIndex
CREATE INDEX "procurement_audit_actorUserId_idx" ON "procurement_audit"("actorUserId");

-- CreateIndex
CREATE INDEX "procurement_audit_requestId_createdAt_id_idx" ON "procurement_audit"("requestId", "createdAt", "id");

-- AddForeignKey
ALTER TABLE "procurement_request" ADD CONSTRAINT "procurement_request_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_request" ADD CONSTRAINT "procurement_request_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_request" ADD CONSTRAINT "procurement_request_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_request" ADD CONSTRAINT "procurement_request_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "master_currencies"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_request_item" ADD CONSTRAINT "procurement_request_item_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_request_version" ADD CONSTRAINT "procurement_request_version_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_request_version" ADD CONSTRAINT "procurement_request_version_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_approval_snapshot" ADD CONSTRAINT "procurement_approval_snapshot_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_approval_snapshot" ADD CONSTRAINT "procurement_approval_snapshot_requestVersionId_requestId_fkey" FOREIGN KEY ("requestVersionId", "requestId") REFERENCES "procurement_request_version"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_approval_step" ADD CONSTRAINT "procurement_approval_step_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "procurement_approval_snapshot"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_approval_step" ADD CONSTRAINT "procurement_approval_step_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_approval_decision" ADD CONSTRAINT "procurement_approval_decision_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "procurement_approval_step"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_approval_decision" ADD CONSTRAINT "procurement_approval_decision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_quotation" ADD CONSTRAINT "procurement_quotation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_quotation" ADD CONSTRAINT "procurement_quotation_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "master_suppliers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_quotation" ADD CONSTRAINT "procurement_quotation_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "master_currencies"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_quotation_item" ADD CONSTRAINT "procurement_quotation_item_quotationId_requestId_fkey" FOREIGN KEY ("quotationId", "requestId") REFERENCES "procurement_quotation"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_quotation_item" ADD CONSTRAINT "procurement_quotation_item_requestItemId_requestId_fkey" FOREIGN KEY ("requestItemId", "requestId") REFERENCES "procurement_request_item"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_selection" ADD CONSTRAINT "procurement_selection_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_selection" ADD CONSTRAINT "procurement_selection_quotationId_requestId_fkey" FOREIGN KEY ("quotationId", "requestId") REFERENCES "procurement_quotation"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_selection" ADD CONSTRAINT "procurement_selection_requestVersionId_requestId_fkey" FOREIGN KEY ("requestVersionId", "requestId") REFERENCES "procurement_request_version"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_selection" ADD CONSTRAINT "procurement_selection_selectedByUserId_fkey" FOREIGN KEY ("selectedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_order" ADD CONSTRAINT "procurement_order_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_order" ADD CONSTRAINT "procurement_order_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "master_suppliers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_order" ADD CONSTRAINT "procurement_order_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "master_currencies"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_order" ADD CONSTRAINT "procurement_order_selectionId_requestId_fkey" FOREIGN KEY ("selectionId", "requestId") REFERENCES "procurement_selection"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_order_version" ADD CONSTRAINT "procurement_order_version_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "procurement_order"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_order_version" ADD CONSTRAINT "procurement_order_version_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_order_item" ADD CONSTRAINT "procurement_order_item_orderId_requestId_fkey" FOREIGN KEY ("orderId", "requestId") REFERENCES "procurement_order"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_order_item" ADD CONSTRAINT "procurement_order_item_requestItemId_requestId_fkey" FOREIGN KEY ("requestItemId", "requestId") REFERENCES "procurement_request_item"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_order_item" ADD CONSTRAINT "procurement_order_item_orderVersionId_orderId_fkey" FOREIGN KEY ("orderVersionId", "orderId") REFERENCES "procurement_order_version"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_receipt" ADD CONSTRAINT "procurement_receipt_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_receipt" ADD CONSTRAINT "procurement_receipt_orderId_requestId_fkey" FOREIGN KEY ("orderId", "requestId") REFERENCES "procurement_order"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_receipt" ADD CONSTRAINT "procurement_receipt_orderVersionId_orderId_fkey" FOREIGN KEY ("orderVersionId", "orderId") REFERENCES "procurement_order_version"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_receipt" ADD CONSTRAINT "procurement_receipt_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_receipt_item" ADD CONSTRAINT "procurement_receipt_item_receiptId_orderId_fkey" FOREIGN KEY ("receiptId", "orderId") REFERENCES "procurement_receipt"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_receipt_item" ADD CONSTRAINT "procurement_receipt_item_orderItemId_orderId_fkey" FOREIGN KEY ("orderItemId", "orderId") REFERENCES "procurement_order_item"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_receipt_item" ADD CONSTRAINT "procurement_receipt_item_receiptId_orderId_orderVersionId_fkey" FOREIGN KEY ("receiptId", "orderId", "orderVersionId") REFERENCES "procurement_receipt"("id", "orderId", "orderVersionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_receipt_item" ADD CONSTRAINT "procurement_receipt_item_orderItemId_orderId_orderVersionI_fkey" FOREIGN KEY ("orderItemId", "orderId", "orderVersionId") REFERENCES "procurement_order_item"("id", "orderId", "orderVersionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_service_acceptance" ADD CONSTRAINT "procurement_service_acceptance_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_service_acceptance" ADD CONSTRAINT "procurement_service_acceptance_orderId_requestId_fkey" FOREIGN KEY ("orderId", "requestId") REFERENCES "procurement_order"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_service_acceptance" ADD CONSTRAINT "procurement_service_acceptance_orderItemId_orderId_fkey" FOREIGN KEY ("orderItemId", "orderId") REFERENCES "procurement_order_item"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_service_acceptance" ADD CONSTRAINT "procurement_service_acceptance_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_service_acceptance" ADD CONSTRAINT "procurement_service_acceptance_orderVersionId_orderId_fkey" FOREIGN KEY ("orderVersionId", "orderId") REFERENCES "procurement_order_version"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_service_acceptance" ADD CONSTRAINT "procurement_service_acceptance_orderItemId_orderId_orderVe_fkey" FOREIGN KEY ("orderItemId", "orderId", "orderVersionId") REFERENCES "procurement_order_item"("id", "orderId", "orderVersionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_discrepancy" ADD CONSTRAINT "procurement_discrepancy_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_discrepancy" ADD CONSTRAINT "procurement_discrepancy_orderId_requestId_fkey" FOREIGN KEY ("orderId", "requestId") REFERENCES "procurement_order"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_discrepancy" ADD CONSTRAINT "procurement_discrepancy_receiptId_orderId_fkey" FOREIGN KEY ("receiptId", "orderId") REFERENCES "procurement_receipt"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_return" ADD CONSTRAINT "procurement_return_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_return" ADD CONSTRAINT "procurement_return_orderId_requestId_fkey" FOREIGN KEY ("orderId", "requestId") REFERENCES "procurement_order"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_return" ADD CONSTRAINT "procurement_return_receiptItemId_orderId_fkey" FOREIGN KEY ("receiptItemId", "orderId") REFERENCES "procurement_receipt_item"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_return" ADD CONSTRAINT "procurement_return_returnedByUserId_fkey" FOREIGN KEY ("returnedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice" ADD CONSTRAINT "procurement_invoice_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice" ADD CONSTRAINT "procurement_invoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "master_suppliers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice" ADD CONSTRAINT "procurement_invoice_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "master_currencies"("code") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice" ADD CONSTRAINT "procurement_invoice_orderId_requestId_fkey" FOREIGN KEY ("orderId", "requestId") REFERENCES "procurement_order"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice" ADD CONSTRAINT "procurement_invoice_issuerLegalEntityId_fkey" FOREIGN KEY ("issuerLegalEntityId") REFERENCES "legal_entities"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice" ADD CONSTRAINT "procurement_invoice_orderVersionId_orderId_fkey" FOREIGN KEY ("orderVersionId", "orderId") REFERENCES "procurement_order_version"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice_item" ADD CONSTRAINT "procurement_invoice_item_invoiceId_orderId_fkey" FOREIGN KEY ("invoiceId", "orderId") REFERENCES "procurement_invoice"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice_item" ADD CONSTRAINT "procurement_invoice_item_orderItemId_orderId_fkey" FOREIGN KEY ("orderItemId", "orderId") REFERENCES "procurement_order_item"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice_item" ADD CONSTRAINT "procurement_invoice_item_invoiceId_orderId_orderVersionId_fkey" FOREIGN KEY ("invoiceId", "orderId", "orderVersionId") REFERENCES "procurement_invoice"("id", "orderId", "orderVersionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice_item" ADD CONSTRAINT "procurement_invoice_item_orderItemId_orderId_orderVersionI_fkey" FOREIGN KEY ("orderItemId", "orderId", "orderVersionId") REFERENCES "procurement_order_item"("id", "orderId", "orderVersionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice_match" ADD CONSTRAINT "procurement_invoice_match_invoiceId_orderId_fkey" FOREIGN KEY ("invoiceId", "orderId") REFERENCES "procurement_invoice"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice_match" ADD CONSTRAINT "procurement_invoice_match_orderVersionId_orderId_fkey" FOREIGN KEY ("orderVersionId", "orderId") REFERENCES "procurement_order_version"("id", "orderId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_invoice_match" ADD CONSTRAINT "procurement_invoice_match_matchedByUserId_fkey" FOREIGN KEY ("matchedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_finance_handoff" ADD CONSTRAINT "procurement_finance_handoff_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_finance_handoff" ADD CONSTRAINT "procurement_finance_handoff_invoiceId_requestId_fkey" FOREIGN KEY ("invoiceId", "requestId") REFERENCES "procurement_invoice"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_outbox" ADD CONSTRAINT "procurement_outbox_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_outbox" ADD CONSTRAINT "procurement_outbox_handoffId_fkey" FOREIGN KEY ("handoffId") REFERENCES "procurement_finance_handoff"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_idempotency" ADD CONSTRAINT "procurement_idempotency_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_idempotency" ADD CONSTRAINT "procurement_idempotency_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_audit" ADD CONSTRAINT "procurement_audit_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_audit" ADD CONSTRAINT "procurement_audit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "procurement_request" ADD CONSTRAINT "procurement_request_values_check" CHECK ("estimatedAmount" >= 0 AND "version" >= 1 AND ("estimatedAmount" IS NULL OR "currencyCode" IS NOT NULL));

ALTER TABLE "procurement_request_item" ADD CONSTRAINT "procurement_request_item_values_check" CHECK ("quantity" > 0);

ALTER TABLE "procurement_request_version" ADD CONSTRAINT "procurement_request_version_values_check" CHECK ("version" >= 1);

ALTER TABLE "procurement_approval_step" ADD CONSTRAINT "procurement_approval_step_values_check" CHECK ("version" >= 1 AND "position" >= 1);

ALTER TABLE "procurement_quotation" ADD CONSTRAINT "procurement_quotation_values_check" CHECK ("totalAmount" >= 0 AND "version" >= 1);

ALTER TABLE "procurement_quotation_item" ADD CONSTRAINT "procurement_quotation_item_values_check" CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "taxAmount" >= 0 AND "discountAmount" >= 0 AND "totalAmount" >= 0 AND "extraCostAmount" >= 0);

ALTER TABLE "procurement_order" ADD CONSTRAINT "procurement_order_values_check" CHECK ("totalAmount" >= 0 AND "version" >= 1);

ALTER TABLE "procurement_order_version" ADD CONSTRAINT "procurement_order_version_values_check" CHECK ("version" >= 1);

ALTER TABLE "procurement_order_item" ADD CONSTRAINT "procurement_order_item_values_check" CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "taxAmount" >= 0 AND "discountAmount" >= 0 AND "totalAmount" >= 0 AND "extraCostAmount" >= 0);

ALTER TABLE "procurement_receipt_item" ADD CONSTRAINT "procurement_receipt_item_values_check" CHECK ("quantity" > 0 AND "acceptedQuantity" >= 0 AND "rejectedQuantity" >= 0 AND "acceptedQuantity" + "rejectedQuantity" <= "quantity");

ALTER TABLE "procurement_service_acceptance" ADD CONSTRAINT "procurement_service_acceptance_values_check" CHECK ("quantity" > 0);

ALTER TABLE "procurement_discrepancy" ADD CONSTRAINT "procurement_discrepancy_values_check" CHECK ("version" >= 1);

ALTER TABLE "procurement_return" ADD CONSTRAINT "procurement_return_values_check" CHECK ("quantity" > 0);

ALTER TABLE "procurement_invoice" ADD CONSTRAINT "procurement_invoice_values_check" CHECK ("totalAmount" >= 0 AND "version" >= 1 AND length(trim("normalizedNumber")) > 0);

ALTER TABLE "procurement_invoice_item" ADD CONSTRAINT "procurement_invoice_item_values_check" CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND "taxAmount" >= 0 AND "discountAmount" >= 0 AND "totalAmount" >= 0 AND "extraCostAmount" >= 0);

ALTER TABLE "procurement_finance_handoff" ADD CONSTRAINT "procurement_finance_handoff_values_check" CHECK ("version" >= 1);

ALTER TABLE "procurement_outbox" ADD CONSTRAINT "procurement_outbox_values_check" CHECK ("attempts" >= 0);

-- Authoritative history survives API defects and accidental updates/deletes.
CREATE FUNCTION procurement_reject_history_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'PROCUREMENT_APPEND_ONLY: % cannot be changed', TG_TABLE_NAME
    USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER "procurement_request_version_immutable" BEFORE UPDATE OR DELETE ON "procurement_request_version" FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
CREATE TRIGGER "procurement_order_version_immutable" BEFORE UPDATE OR DELETE ON "procurement_order_version" FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
CREATE TRIGGER "procurement_approval_snapshot_immutable" BEFORE UPDATE OR DELETE ON "procurement_approval_snapshot" FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
CREATE TRIGGER "procurement_approval_decision_immutable" BEFORE UPDATE OR DELETE ON "procurement_approval_decision" FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
CREATE TRIGGER "procurement_selection_immutable" BEFORE UPDATE OR DELETE ON "procurement_selection" FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
CREATE TRIGGER "procurement_receipt_immutable" BEFORE UPDATE OR DELETE ON "procurement_receipt" FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
CREATE TRIGGER "procurement_receipt_item_immutable" BEFORE UPDATE OR DELETE ON "procurement_receipt_item" FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
CREATE TRIGGER "procurement_service_acceptance_immutable" BEFORE UPDATE OR DELETE ON "procurement_service_acceptance" FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
CREATE TRIGGER "procurement_return_immutable" BEFORE UPDATE OR DELETE ON "procurement_return" FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
CREATE TRIGGER "procurement_invoice_match_immutable" BEFORE UPDATE OR DELETE ON "procurement_invoice_match" FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
CREATE TRIGGER "procurement_audit_immutable" BEFORE UPDATE OR DELETE ON "procurement_audit" FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
CREATE TRIGGER "procurement_idempotency_immutable" BEFORE UPDATE OR DELETE ON "procurement_idempotency" FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();
