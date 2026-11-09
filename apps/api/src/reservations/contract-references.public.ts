import type { Prisma } from '@nora/database';

/** Reference-only projection for contract company/archive scoping in Finance. */
export function contractIntakeReferences(
  db: Prisma.TransactionClient,
  contractIds: string[],
) {
  return db.reservationIntake.findMany({
    where: { contractId: { in: contractIds } },
    select: {
      id: true,
      requestId: true,
      servicePurchases: { select: { id: true } },
    },
  });
}
