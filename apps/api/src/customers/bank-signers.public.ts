import type { Prisma } from '@nora/database';

export function eligibleBankSigners(
  tx: Prisma.TransactionClient,
  branchId: string,
  personIds: string[],
) {
  return tx.customer.findMany({
    where: {
      id: { in: personIds },
      kind: 'PERSON',
      ownerBranchId: branchId,
      isActive: true,
      mergedIntoId: null,
    },
    select: { id: true },
  });
}
