CREATE TYPE "FinanceSupplierPaymentStatus" AS ENUM ('PAID', 'REJECTED');

CREATE TABLE "ReservationServicePurchase" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "intakeId" UUID NOT NULL,
  "serviceClientKey" VARCHAR(160) NOT NULL,
  "serviceKind" VARCHAR(32) NOT NULL,
  "serviceTitleSnapshot" VARCHAR(300) NOT NULL,
  "supplierOrganizationId" UUID NOT NULL,
  "supplierNameSnapshot" VARCHAR(200) NOT NULL,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "amount" DECIMAL(24,4) NOT NULL CHECK ("amount" > 0),
  "currencyCode" VARCHAR(3) NOT NULL CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
  "actorUserId" UUID NOT NULL,
  "idempotencyKey" VARCHAR(160) NOT NULL,
  "fingerprint" CHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReservationServicePurchase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReservationServicePurchase_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ReservationIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReservationServicePurchase_supplierOrganizationId_fkey" FOREIGN KEY ("supplierOrganizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReservationServicePurchase_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ReservationServicePurchase_intakeId_version_key" ON "ReservationServicePurchase"("intakeId", "version");
CREATE UNIQUE INDEX "ReservationServicePurchase_actorUserId_idempotencyKey_key" ON "ReservationServicePurchase"("actorUserId", "idempotencyKey");
CREATE INDEX "ReservationServicePurchase_intakeId_serviceClientKey_version_idx" ON "ReservationServicePurchase"("intakeId", "serviceClientKey", "version");
CREATE INDEX "ReservationServicePurchase_supplierOrganizationId_createdAt_idx" ON "ReservationServicePurchase"("supplierOrganizationId", "createdAt");

CREATE TABLE "FinanceSupplierPaymentRevision" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "purchaseId" UUID NOT NULL,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "status" "FinanceSupplierPaymentStatus" NOT NULL,
  "bankId" UUID,
  "transferAt" TIMESTAMPTZ(3),
  "paymentReference" VARCHAR(160),
  "reason" VARCHAR(500) NOT NULL,
  "actorUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FinanceSupplierPaymentRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FinanceSupplierPaymentRevision_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "ReservationServicePurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceSupplierPaymentRevision_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "master_banks"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceSupplierPaymentRevision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "FinanceSupplierPaymentRevision_paid_fields_check" CHECK (
    ("status" = 'PAID' AND "bankId" IS NOT NULL AND "transferAt" IS NOT NULL AND "paymentReference" IS NOT NULL)
    OR ("status" = 'REJECTED' AND "bankId" IS NULL AND "transferAt" IS NULL AND "paymentReference" IS NULL)
  )
);

CREATE UNIQUE INDEX "FinanceSupplierPaymentRevision_purchaseId_version_key" ON "FinanceSupplierPaymentRevision"("purchaseId", "version");
CREATE INDEX "FinanceSupplierPaymentRevision_status_createdAt_idx" ON "FinanceSupplierPaymentRevision"("status", "createdAt");
CREATE INDEX "FinanceSupplierPaymentRevision_bankId_transferAt_idx" ON "FinanceSupplierPaymentRevision"("bankId", "transferAt");
