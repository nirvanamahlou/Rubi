import type { Prisma } from '@nora/database';
/** Contract ownership is verified separately from Finance branch membership. */
export async function bankContractVisible(
  tx: Prisma.TransactionClient,
  id: string,
  branchId: string,
  issuerId: string,
) {
  return !!(await tx.salesContract.count({
    where: { id, branchId, legalEntityId: issuerId, financeHiddenAt: null },
  }));
}
