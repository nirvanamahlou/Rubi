import type { Prisma } from '@nora/database';

/** Reference-only owner port; callers must resolve contract visibility through Sales. */
export async function financeReservationContractReferences(
  db: Prisma.TransactionClient,
  branchIds: readonly string[],
  intakeIds: string[],
  purchaseIds: string[],
) {
  const rows = await db.reservationIntake.findMany({
    where: {
      branchId: { in: [...branchIds] },
      OR: [
        { id: { in: intakeIds } },
        { servicePurchases: { some: { id: { in: purchaseIds } } } },
      ],
    },
    select: {
      id: true,
      contractId: true,
      servicePurchases: {
        where: { id: { in: purchaseIds } },
        select: { id: true },
      },
    },
  });
  return rows;
}
