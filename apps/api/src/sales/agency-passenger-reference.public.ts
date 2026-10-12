import type { DatabaseClient } from '@nora/database';

/** Sales-owned projection for a verified agency membership and its customer references. */
export function agencyContractPassengerReferences(
  db: DatabaseClient,
  buyerIds: string[],
  branchId: string,
  contractId?: string,
) {
  return db.salesContract.findMany({
    where: {
      branchId,
      customerId: { in: buyerIds },
      ...(contractId ? { id: contractId } : {}),
      status: { not: 'CANCELLED' },
    },
    select: {
      id: true,
      contractNumber: true,
      passengers: { select: { customerId: true, displayNameSnapshot: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
}
