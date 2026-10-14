ALTER TABLE "FinanceTicketPurchasePaymentRevision" ALTER COLUMN "accountId" DROP NOT NULL;
ALTER TABLE "FinanceTicketPurchasePaymentRevision" ADD COLUMN "payingSupplierId" UUID;
ALTER TABLE "finance_procurement_invoice_revisions" ADD COLUMN "payingSupplierId" UUID;
ALTER TABLE "FinanceSupplierPaymentRevision" ADD COLUMN "payingSupplierId" UUID;
ALTER TABLE "FinanceTicketPurchasePaymentRevision" ADD CONSTRAINT "FinanceTicketPurchasePaymentRevision_payingSupplierId_fkey" FOREIGN KEY ("payingSupplierId") REFERENCES "master_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance_procurement_invoice_revisions" ADD CONSTRAINT "finance_procurement_invoice_revisions_payingSupplierId_fkey" FOREIGN KEY ("payingSupplierId") REFERENCES "master_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceSupplierPaymentRevision" ADD CONSTRAINT "FinanceSupplierPaymentRevision_payingSupplierId_fkey" FOREIGN KEY ("payingSupplierId") REFERENCES "master_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceTicketPurchasePaymentRevision" ADD COLUMN "payingSupplierName" VARCHAR(200);
ALTER TABLE "finance_procurement_invoice_revisions" ADD COLUMN "payingSupplierName" VARCHAR(200), ADD COLUMN "paymentCurrencyCode" VARCHAR(3);
ALTER TABLE "FinanceSupplierPaymentRevision" ADD COLUMN "payingSupplierName" VARCHAR(200);
ALTER TABLE "finance_operational_revisions" ADD COLUMN "payingSupplierId" UUID;
ALTER TABLE "finance_operational_revisions" ADD CONSTRAINT "finance_operational_revisions_payingSupplierId_fkey" FOREIGN KEY ("payingSupplierId") REFERENCES "master_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance_operational_revisions" DROP CONSTRAINT "finance_revision_payment";
ALTER TABLE "finance_operational_revisions" ADD CONSTRAINT "finance_revision_payment" CHECK (
  ("action" = 'PAY' AND "paidAmount" > 0 AND
    (("accountId" IS NOT NULL)::int + ("payingSupplierId" IS NOT NULL)::int) = 1
    AND "methodId" IS NOT NULL AND "transferAt" IS NOT NULL)
  OR ("action" <> 'PAY' AND "paidAmount" IS NULL)
);
ALTER TABLE "FinanceTicketPurchasePaymentRevision" ADD CONSTRAINT "finance_ticket_payment_source" CHECK (
  (("accountId" IS NOT NULL)::int + ("payingSupplierId" IS NOT NULL)::int) = 1
);
ALTER TABLE "finance_procurement_invoice_revisions" ADD CONSTRAINT "finance_invoice_payment_source" CHECK (
  "payingSupplierId" IS NULL OR "accountId" IS NULL
);
ALTER TABLE "FinanceSupplierPaymentRevision" ADD CONSTRAINT "finance_service_payment_source" CHECK (
  "payingSupplierId" IS NULL OR "accountId" IS NULL
);
