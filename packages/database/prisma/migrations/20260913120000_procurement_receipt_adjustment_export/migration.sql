-- CreateTable
CREATE TABLE "procurement_receipt_adjustment" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "orderVersionId" UUID NOT NULL,
    "receiptItemId" UUID NOT NULL,
    "receivedDelta" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "acceptedDelta" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "rejectedDelta" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "actorUserId" UUID NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "procurement_receipt_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "procurement_export_job" (
    "id" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "requestId" UUID,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "format" VARCHAR(10) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'QUEUED',
    "version" INTEGER NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "payloadJson" JSONB NOT NULL,
    "resultJson" JSONB,
    "errorCode" VARCHAR(80),
    "availableAt" TIMESTAMPTZ(3),
    "leaseUntil" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "procurement_export_job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "procurement_receipt_adjustment_requestId_createdAt_idx" ON "procurement_receipt_adjustment"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "procurement_receipt_adjustment_orderId_requestId_idx" ON "procurement_receipt_adjustment"("orderId", "requestId");

-- CreateIndex
CREATE INDEX "procurement_receipt_adjustment_receiptItemId_orderId_orderV_idx" ON "procurement_receipt_adjustment"("receiptItemId", "orderId", "orderVersionId");

-- CreateIndex
CREATE INDEX "procurement_receipt_adjustment_actorUserId_idx" ON "procurement_receipt_adjustment"("actorUserId");

-- CreateIndex
CREATE INDEX "procurement_export_job_status_availableAt_idx" ON "procurement_export_job"("status", "availableAt");

-- CreateIndex
CREATE INDEX "procurement_export_job_actorUserId_createdAt_idx" ON "procurement_export_job"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "procurement_export_job_branchId_idx" ON "procurement_export_job"("branchId");

-- CreateIndex
CREATE INDEX "procurement_export_job_requestId_branchId_idx" ON "procurement_export_job"("requestId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_export_job_actorUserId_idempotencyKey_key" ON "procurement_export_job"("actorUserId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_request_id_branchId_key" ON "procurement_request"("id", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "procurement_receipt_item_id_orderId_orderVersionId_key" ON "procurement_receipt_item"("id", "orderId", "orderVersionId");

-- AddForeignKey
ALTER TABLE "procurement_receipt_adjustment" ADD CONSTRAINT "procurement_receipt_adjustment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "procurement_request"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_receipt_adjustment" ADD CONSTRAINT "procurement_receipt_adjustment_orderId_requestId_fkey" FOREIGN KEY ("orderId", "requestId") REFERENCES "procurement_order"("id", "requestId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_receipt_adjustment" ADD CONSTRAINT "procurement_receipt_adjustment_receiptItemId_orderId_order_fkey" FOREIGN KEY ("receiptItemId", "orderId", "orderVersionId") REFERENCES "procurement_receipt_item"("id", "orderId", "orderVersionId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_receipt_adjustment" ADD CONSTRAINT "procurement_receipt_adjustment_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_export_job" ADD CONSTRAINT "procurement_export_job_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_export_job" ADD CONSTRAINT "procurement_export_job_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "procurement_export_job" ADD CONSTRAINT "procurement_export_job_requestId_branchId_fkey" FOREIGN KEY ("requestId", "branchId") REFERENCES "procurement_request"("id", "branchId") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Compensation may be signed; only the transactional owner service can validate
-- resulting aggregate quantities and the approval provenance in data.
ALTER TABLE "procurement_receipt_adjustment"
  ADD CONSTRAINT "procurement_receipt_adjustment_delta_check" CHECK (
    "receivedDelta" <> 'NaN'::numeric
    AND "acceptedDelta" <> 'NaN'::numeric
    AND "rejectedDelta" <> 'NaN'::numeric
    AND ("receivedDelta" <> 0 OR "acceptedDelta" <> 0 OR "rejectedDelta" <> 0)
    AND length(btrim("reason")) > 0
  );

CREATE TRIGGER "procurement_receipt_adjustment_immutable"
  BEFORE UPDATE OR DELETE ON "procurement_receipt_adjustment"
  FOR EACH ROW EXECUTE FUNCTION procurement_reject_history_mutation();

ALTER TABLE "procurement_export_job"
  ADD CONSTRAINT "procurement_export_job_values_check" CHECK (
    "version" >= 1 AND "attempts" >= 0
    AND "requestHash" ~ '^[0-9a-f]{64}$'
    AND length(btrim("idempotencyKey")) > 0
  );
