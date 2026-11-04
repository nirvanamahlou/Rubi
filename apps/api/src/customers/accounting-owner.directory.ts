import type { Prisma } from '@nora/database';

/** Public Customers projection for an accounting command in the same transaction. */
export function accountingOwner(
  tx: Prisma.TransactionClient,
  id: string,
  branchId: string,
  company: boolean,
) {
  return tx.customer.findFirst({
    where: {
      id,
      ownerBranchId: branchId,
      mergedIntoId: null,
      isActive: true,
      kind: company ? 'ORGANIZATION' : 'PERSON',
    },
    select: { id: true, displayName: true },
  });
}
