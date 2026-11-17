BEGIN;
-- AlterTable
ALTER TABLE "FinanceTicketPurchasePaymentRevision" ADD COLUMN     "beneficiaryId" UUID,
ADD COLUMN     "brokerTransferId" UUID;

-- AlterTable
ALTER TABLE "finance_procurement_invoice_revisions" ADD COLUMN     "beneficiaryId" UUID,
ADD COLUMN     "brokerTransferId" UUID;

-- AlterTable
ALTER TABLE "FinanceSupplierPaymentRevision" ADD COLUMN     "beneficiaryId" UUID,
ADD COLUMN     "brokerTransferId" UUID;

-- AlterTable
ALTER TABLE "FinanceExchangeMovement" ADD COLUMN     "brokerTransferId" UUID;

-- CreateTable
CREATE TABLE "finance_beneficiaries" (
    "bankBranchId" UUID NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "ibanFingerprint" VARCHAR(64),
    "supplierId" UUID,
    "brokerId" UUID,
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "direction" VARCHAR(10) NOT NULL,
    "blacklisted" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "note" VARCHAR(500) NOT NULL,

    CONSTRAINT "finance_beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_broker_transfers" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "officeId" UUID NOT NULL,
    "brokerId" UUID NOT NULL,
    "purchaseId" UUID,
    "invoiceId" UUID,
    "costId" UUID,
    "currency" VARCHAR(3) NOT NULL,
    "amount" DECIMAL(24,4) NOT NULL,
    "rate" DECIMAL(24,8) NOT NULL,
    "sentAt" TIMESTAMPTZ(3) NOT NULL,
    "makerId" UUID NOT NULL,
    "receiptId" UUID,
    "receivedAt" TIMESTAMPTZ(3),
    "confirmedBy" UUID,

    CONSTRAINT "finance_broker_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_bank_statements" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "periodId" UUID NOT NULL,
    "bankId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "detailId" UUID,
    "from" VARCHAR(10) NOT NULL,
    "to" VARCHAR(10) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "opening" DECIMAL(38,18) NOT NULL,
    "closing" DECIMAL(38,18) NOT NULL,
    "closedAt" TIMESTAMPTZ(3),

    CONSTRAINT "finance_bank_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_bank_statement_rows" (
    "id" UUID NOT NULL,
    "statementId" UUID NOT NULL,
    "seq" INTEGER NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "reference" VARCHAR(160) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "lineId" UUID,

    CONSTRAINT "finance_bank_statement_rows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "finance_beneficiaries_bookId_accountId_key" ON "finance_beneficiaries"("bookId", "accountId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_broker_transfers_receiptId_key" ON "finance_broker_transfers"("receiptId");

-- CreateIndex
CREATE INDEX "finance_broker_transfers_bookId_brokerId_sentAt_idx" ON "finance_broker_transfers"("bookId", "brokerId", "sentAt");

-- CreateIndex
CREATE INDEX "finance_broker_transfers_purchaseId_idx" ON "finance_broker_transfers"("purchaseId");

-- CreateIndex
CREATE INDEX "finance_broker_transfers_costId_idx" ON "finance_broker_transfers"("costId");

-- CreateIndex
CREATE INDEX "finance_broker_transfers_invoiceId_idx" ON "finance_broker_transfers"("invoiceId");

-- CreateIndex
CREATE INDEX "finance_bank_statements_bookId_bankId_from_to_idx" ON "finance_bank_statements"("bookId", "bankId", "from", "to");

-- CreateIndex
CREATE UNIQUE INDEX "finance_bank_statement_rows_lineId_key" ON "finance_bank_statement_rows"("lineId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_bank_statement_rows_statementId_seq_key" ON "finance_bank_statement_rows"("statementId", "seq");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceTicketPurchasePaymentRevision_brokerTransferId_key" ON "FinanceTicketPurchasePaymentRevision"("brokerTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_procurement_invoice_revisions_brokerTransferId_key" ON "finance_procurement_invoice_revisions"("brokerTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceSupplierPaymentRevision_brokerTransferId_key" ON "FinanceSupplierPaymentRevision"("brokerTransferId");

-- CreateIndex
CREATE UNIQUE INDEX "FinanceExchangeMovement_brokerTransferId_key" ON "FinanceExchangeMovement"("brokerTransferId");

-- AddForeignKey
ALTER TABLE "FinanceTicketPurchasePaymentRevision" ADD CONSTRAINT "FinanceTicketPurchasePaymentRevision_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "finance_beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceTicketPurchasePaymentRevision" ADD CONSTRAINT "FinanceTicketPurchasePaymentRevision_brokerTransferId_fkey" FOREIGN KEY ("brokerTransferId") REFERENCES "finance_broker_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_procurement_invoice_revisions" ADD CONSTRAINT "finance_procurement_invoice_revisions_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "finance_beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_procurement_invoice_revisions" ADD CONSTRAINT "finance_procurement_invoice_revisions_brokerTransferId_fkey" FOREIGN KEY ("brokerTransferId") REFERENCES "finance_broker_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSupplierPaymentRevision" ADD CONSTRAINT "FinanceSupplierPaymentRevision_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "finance_beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceSupplierPaymentRevision" ADD CONSTRAINT "FinanceSupplierPaymentRevision_brokerTransferId_fkey" FOREIGN KEY ("brokerTransferId") REFERENCES "finance_broker_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinanceExchangeMovement" ADD CONSTRAINT "FinanceExchangeMovement_brokerTransferId_fkey" FOREIGN KEY ("brokerTransferId") REFERENCES "finance_broker_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_beneficiaries" ADD CONSTRAINT "finance_beneficiaries_bankBranchId_fkey" FOREIGN KEY ("bankBranchId") REFERENCES "master_bank_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_beneficiaries" ADD CONSTRAINT "finance_beneficiaries_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "master_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_beneficiaries" ADD CONSTRAINT "finance_beneficiaries_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "master_brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_beneficiaries" ADD CONSTRAINT "finance_beneficiaries_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_beneficiaries" ADD CONSTRAINT "finance_beneficiaries_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_beneficiaries" ADD CONSTRAINT "finance_beneficiaries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "FinanceSettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_broker_transfers" ADD CONSTRAINT "finance_broker_transfers_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_broker_transfers" ADD CONSTRAINT "finance_broker_transfers_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_broker_transfers" ADD CONSTRAINT "finance_broker_transfers_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "FinanceExchangeOffice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_broker_transfers" ADD CONSTRAINT "finance_broker_transfers_brokerId_fkey" FOREIGN KEY ("brokerId") REFERENCES "master_brokers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_broker_transfers" ADD CONSTRAINT "finance_broker_transfers_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "ReservationServicePurchase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_broker_transfers" ADD CONSTRAINT "finance_broker_transfers_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "procurement_invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_broker_transfers" ADD CONSTRAINT "finance_broker_transfers_costId_fkey" FOREIGN KEY ("costId") REFERENCES "FinanceTicketPurchaseCostRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_broker_transfers" ADD CONSTRAINT "finance_broker_transfers_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_bank_statements" ADD CONSTRAINT "finance_bank_statements_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_bank_statements" ADD CONSTRAINT "finance_bank_statements_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_bank_statements" ADD CONSTRAINT "finance_bank_statements_bankId_fkey" FOREIGN KEY ("bankId") REFERENCES "FinanceSettlementAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_bank_statements" ADD CONSTRAINT "finance_bank_statements_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_bank_statements" ADD CONSTRAINT "finance_bank_statements_detailId_fkey" FOREIGN KEY ("detailId") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_bank_statement_rows" ADD CONSTRAINT "finance_bank_statement_rows_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "finance_bank_statements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "finance_bank_statement_rows" ADD CONSTRAINT "finance_bank_statement_rows_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "accounting_journal_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE finance_broker_transfers ADD COLUMN "receiptVersionId" uuid REFERENCES document_versions(id) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE finance_broker_transfers ADD CHECK(num_nonnulls("purchaseId","invoiceId","costId")=1 AND amount>0 AND rate>0 AND num_nonnulls("receivedAt","receiptId","receiptVersionId","confirmedBy") IN (0,4));
ALTER TABLE finance_beneficiaries ADD CHECK(direction IN ('ALL','PAYMENT','RECEIPT'));
ALTER TABLE finance_bank_statements ADD CHECK("from"<="to");
ALTER TABLE finance_bank_statement_rows ADD CHECK(amount<>0 AND seq>0);
ALTER TABLE "FinanceExchangeMovement" DROP CONSTRAINT exchange_movement_shape;
ALTER TABLE "FinanceExchangeMovement" ADD CONSTRAINT exchange_movement_shape CHECK (
 "afterAmount" >= 0 AND "afterAmount" < 'Infinity'::numeric AND delta > '-Infinity'::numeric AND delta < 'Infinity'::numeric AND
 ((kind='BROKER_TRANSFER' AND delta<0 AND "brokerTransferId" IS NOT NULL AND num_nonnulls("supplierPaymentId","ticketPaymentId","invoicePaymentId")=0) OR
 ("brokerTransferId" IS NULL AND ((kind='PAYMENT' AND delta<0 AND num_nonnulls("supplierPaymentId","ticketPaymentId","invoicePaymentId")=1) OR
 (kind='ADJUSTMENT' AND num_nonnulls("supplierPaymentId","ticketPaymentId","invoicePaymentId")=0)))));
COMMIT;
