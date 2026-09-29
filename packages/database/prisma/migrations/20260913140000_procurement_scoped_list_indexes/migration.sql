-- PROCUREMENT-001 measured list optimization: first-page and unit-scoped lists
-- lacked a matching sort prefix; deep OFFSET pages spilled wide rows to disk.
-- Existing status/owner/requester indexes remain available for their own filters.
CREATE INDEX "procurement_request_branchId_createdAt_id_idx"
  ON "procurement_request"("branchId", "createdAt", "id");

CREATE INDEX "procurement_request_branchId_unitId_createdAt_id_idx"
  ON "procurement_request"("branchId", "unitId", "createdAt", "id");
