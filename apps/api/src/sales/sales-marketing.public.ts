import type { Prisma } from '@nora/database';

/** Returns only the contract and payment milestones needed by the marketing funnel. */
export async function marketingContractMilestones(
  db: Prisma.TransactionClient,
  branchIds: string[],
  customerIds: string[],
) {
  if (!branchIds.length || !customerIds.length) return [];
  return db.salesContract.findMany({
    where: {
      branchId: { in: branchIds },
      customerId: { in: customerIds },
      status: { not: 'CANCELLED' },
      hiddenAt: null,
    },
    select: {
      branchId: true,
      customerId: true,
      createdAt: true,
      payments: {
        where: {
          status: 'FINANCE_CONFIRMED',
          amount: { gt: 0 },
          financeConfirmedAt: { not: null },
        },
        orderBy: { financeConfirmedAt: 'asc' },
        take: 1,
        select: { financeConfirmedAt: true },
      },
    },
  });
}
