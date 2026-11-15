-- Keep the published first migration immutable. Align this new FK's update rule
-- with the Prisma Branch relation without changing or deleting any business row.
ALTER TABLE "website_catalog_deliveries"
  DROP CONSTRAINT "website_catalog_deliveries_branchId_fkey",
  ADD CONSTRAINT "website_catalog_deliveries_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "branches"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
