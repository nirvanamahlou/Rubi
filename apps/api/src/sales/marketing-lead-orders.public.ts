import type { DatabaseService } from '../database/database.service';

export function marketingLeadOrders(
  database: DatabaseService,
  branchIds: string[],
  customerIds: string[],
) {
  return customerIds.length
    ? database.client.salesContract.findMany({
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
            where: { status: 'FINANCE_CONFIRMED', amount: { gt: 0 } },
            select: { financeConfirmedAt: true },
            orderBy: { financeConfirmedAt: 'asc' },
            take: 1,
          },
        },
      })
    : [];
}
