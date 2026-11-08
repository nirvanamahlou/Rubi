BEGIN;
-- AlterTable
ALTER TABLE "FinanceTicketPurchasePaymentRevision" ADD COLUMN     "exchangeOfficeId" UUID,
ADD COLUMN     "exchangeOfficeName" VARCHAR(200);

-- AlterTable
ALTER TABLE "finance_procurement_invoice_revisions" ADD COLUMN     "exchangeOfficeId" UUID,
ADD COLUMN     "exchangeOfficeName" VARCHAR(200);

-- AlterTable
ALTER TABLE "FinanceSupplierPaymentRevision" ADD COLUMN     "exchangeOfficeId" UUID,
ADD COLUMN     "exchangeOfficeName" VARCHAR(200);

-- CreateTable
CREATE TABLE "FinanceExchangeOffice" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "countryId" UUID,
    "address" VARCHAR(1000),
    "phone" VARCHAR(80),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "createdByUserId" UUID NOT NULL,

    CONSTRAINT "FinanceExchangeOffice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceExchangeBalance" (
    "id" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "currencyCode" CHAR(3) NOT NULL,
    "amount" DECIMAL(24,4) NOT NULL DEFAULT 0,

    CONSTRAINT "FinanceExchangeBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceExchangeMovement" (
    "id" UUID NOT NULL,
    "balanceId" UUID NOT NULL,
    "delta" DECIMAL(24,4) NOT NULL,
    "afterAmount" DECIMAL(24,4) NOT NULL,
    "kind" VARCHAR(24) NOT NULL,
    "actorUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierPaymentId" UUID,
    "ticketPaymentId" UUID,
    "invoicePaymentId" UUID,

    CONSTRAINT "FinanceExchangeMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinanceExchangeAudit" (
    "id" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "action" VARCHAR(24) NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FinanceExchangeAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinanceExchangeOffice_deletedAt_isActive_title_idx" ON "FinanceExchangeOffice"("deletedAt", "isActive", "title");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceExchangeBalance_officeId_currencyCode_key" ON "FinanceExchangeBalance"("officeId", "currencyCode");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceExchangeMovement_supplierPaymentId_key" ON "FinanceExchangeMovement"("supplierPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceExchangeMovement_ticketPaymentId_key" ON "FinanceExchangeMovement"("ticketPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceExchangeMovement_invoicePaymentId_key" ON "FinanceExchangeMovement"("invoicePaymentId");

-- CreateIndex
CREATE INDEX "FinanceExchangeMovement_balanceId_createdAt_idx" ON "FinanceExchangeMovement"("balanceId", "createdAt");

-- CreateIndex
CREATE INDEX "FinanceExchangeAudit_officeId_createdAt_idx" ON "FinanceExchangeAudit"("officeId", "createdAt");

-- AddForeignKey
ALTER TABLE "FinanceTicketPurchasePaymentRevision" ADD CONSTRAINT "FinanceTicketPurchasePaymentRevision_exchangeOfficeId_fkey" FOREIGN KEY ("exchangeOfficeId") REFERENCES "FinanceExchangeOffice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_procurement_invoice_revisions" ADD CONSTRAINT "finance_procurement_invoice_revisions_exchangeOfficeId_fkey" FOREIGN KEY ("exchangeOfficeId") REFERENCES "FinanceExchangeOffice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSupplierPaymentRevision" ADD CONSTRAINT "FinanceSupplierPaymentRevision_exchangeOfficeId_fkey" FOREIGN KEY ("exchangeOfficeId") REFERENCES "FinanceExchangeOffice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExchangeOffice" ADD CONSTRAINT "FinanceExchangeOffice_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "master_countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExchangeOffice" ADD CONSTRAINT "FinanceExchangeOffice_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExchangeBalance" ADD CONSTRAINT "FinanceExchangeBalance_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "FinanceExchangeOffice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExchangeBalance" ADD CONSTRAINT "FinanceExchangeBalance_currencyCode_fkey" FOREIGN KEY ("currencyCode") REFERENCES "master_currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExchangeMovement" ADD CONSTRAINT "FinanceExchangeMovement_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "FinanceExchangeBalance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExchangeMovement" ADD CONSTRAINT "FinanceExchangeMovement_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExchangeMovement" ADD CONSTRAINT "FinanceExchangeMovement_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "FinanceSupplierPaymentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExchangeMovement" ADD CONSTRAINT "FinanceExchangeMovement_ticketPaymentId_fkey" FOREIGN KEY ("ticketPaymentId") REFERENCES "FinanceTicketPurchasePaymentRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExchangeMovement" ADD CONSTRAINT "FinanceExchangeMovement_invoicePaymentId_fkey" FOREIGN KEY ("invoicePaymentId") REFERENCES "finance_procurement_invoice_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExchangeAudit" ADD CONSTRAINT "FinanceExchangeAudit_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "FinanceExchangeOffice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExchangeAudit" ADD CONSTRAINT "FinanceExchangeAudit_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "FinanceTicketPurchasePaymentRevision" DROP CONSTRAINT "finance_ticket_payment_source";
ALTER TABLE "FinanceTicketPurchasePaymentRevision" ADD CONSTRAINT "finance_ticket_payment_source" CHECK (num_nonnulls("accountId", "payingSupplierId", "exchangeOfficeId") = 1);

ALTER TABLE "finance_procurement_invoice_revisions" DROP CONSTRAINT "finance_invoice_payment_source";
ALTER TABLE "finance_procurement_invoice_revisions" ADD CONSTRAINT "finance_invoice_payment_source" CHECK (num_nonnulls("accountId", "payingSupplierId", "exchangeOfficeId") <= 1);

ALTER TABLE "FinanceSupplierPaymentRevision" DROP CONSTRAINT "finance_service_payment_source";
ALTER TABLE "FinanceSupplierPaymentRevision" ADD CONSTRAINT "finance_service_payment_source" CHECK (num_nonnulls("accountId", "payingSupplierId", "exchangeOfficeId") <= 1);

ALTER TABLE "FinanceExchangeBalance" ADD CONSTRAINT exchange_balance_nonnegative CHECK (amount >= 0 AND amount < 'Infinity'::numeric);
ALTER TABLE "FinanceExchangeMovement" ADD CONSTRAINT exchange_movement_shape CHECK (
 "afterAmount" >= 0 AND "afterAmount" < 'Infinity'::numeric AND delta > '-Infinity'::numeric AND delta < 'Infinity'::numeric AND
 ((kind = 'PAYMENT' AND delta < 0 AND num_nonnulls("supplierPaymentId", "ticketPaymentId", "invoicePaymentId") = 1) OR
  (kind = 'ADJUSTMENT' AND num_nonnulls("supplierPaymentId", "ticketPaymentId", "invoicePaymentId") = 0))
);
CREATE FUNCTION finance_exchange_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Exchange movements and audit are append-only'; END;
$$;
CREATE TRIGGER exchange_movement_immutable BEFORE UPDATE OR DELETE ON "FinanceExchangeMovement" FOR EACH ROW EXECUTE FUNCTION finance_exchange_immutable();
CREATE TRIGGER exchange_audit_immutable BEFORE UPDATE OR DELETE ON "FinanceExchangeAudit" FOR EACH ROW EXECUTE FUNCTION finance_exchange_immutable();
COMMIT;
