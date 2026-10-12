import type { DatabaseClient } from '@nora/database';

/** Customer-owned organizational identities; never exposes the customer directory. */
export async function agencyBuyerReferences(
  db: DatabaseClient,
  organizationId: string,
  branchId: string,
) {
  const rows = await db.customer.findMany({
    where: { organizationId, ownerBranchId: branchId, isActive: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}
