-- Preserve the published ticket-purchase intake and enforce its IAM/branch references.
ALTER TABLE "ProcurementTicketPurchaseRequest"
  ADD CONSTRAINT "ProcurementTicketPurchaseRequest_branchId_fkey"
  FOREIGN KEY ("branchId") REFERENCES "branches"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;

ALTER TABLE "ProcurementTicketPurchaseRequest"
  ADD CONSTRAINT "ProcurementTicketPurchaseRequest_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id")
  ON DELETE RESTRICT ON UPDATE RESTRICT;
