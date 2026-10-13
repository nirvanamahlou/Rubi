CREATE TABLE "ProcurementTicketPurchaseRequest" (
    "id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "branchId" UUID NOT NULL,
    "catalogProductReference" VARCHAR(160) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "serviceDate" DATE NOT NULL,
    "supplierDisplaySnapshot" VARCHAR(160),
    "amount" DECIMAL(20,6) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "createdByUserId" UUID NOT NULL,
    "createKey" VARCHAR(160) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcurementTicketPurchaseRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProcurementTicketPurchaseRequest_amount_positive" CHECK ("amount" > 0),
    CONSTRAINT "ProcurementTicketPurchaseRequest_currency_code" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
    CONSTRAINT "ProcurementTicketPurchaseRequest_status" CHECK ("status" IN ('PENDING', 'PAID', 'CANCELLED'))
);

CREATE UNIQUE INDEX "ProcurementTicketPurchaseRequest_createdByUserId_createKey_key"
ON "ProcurementTicketPurchaseRequest"("createdByUserId", "createKey");

CREATE UNIQUE INDEX "ProcurementTicketPurchaseRequest_branchId_catalogProductReference_key"
ON "ProcurementTicketPurchaseRequest"("branchId", "catalogProductReference");

CREATE INDEX "ProcurementTicketPurchaseRequest_branchId_status_serviceDate_idx"
ON "ProcurementTicketPurchaseRequest"("branchId", "status", "serviceDate");
