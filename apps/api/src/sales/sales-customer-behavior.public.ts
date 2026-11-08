import type { Prisma, DatabaseClient } from '@nora/database';
import type { DashboardSourceQuery } from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';
import type { CustomerBehaviorSignals } from '../common/customer-behavior-signals';

/** Current successful service purchases. Unlike historical loyalty cohorts, cancellations are excluded. */
export async function readSalesCustomerBehavior(
  client: DatabaseClient,
  q: DashboardSourceQuery,
): Promise<CustomerBehaviorSignals> {
  const p = q.actor.permissions,
    all = p.includes('sales.contracts.read.all'),
    branch = p.includes('sales.contracts.read.branch');
  if (
    !p.includes('customers.read') ||
    !p.includes('sales.payments.read') ||
    (!all &&
      ((!branch && !p.includes('sales.contracts.read.own')) ||
        !q.actor.branchIds.length))
  )
    return { state: 'forbidden' };
  if (
    unsupportedDashboardFilters(q, ['branch']) ||
    !['effective', 'paid'].includes(q.dateBasis)
  )
    return {
      state: 'unsupported',
      reason: 'CUSTOMER_COHORT_FILTER_UNSUPPORTED',
    };
  const scope: Prisma.SalesContractWhereInput = {
    ...(!all ? { branchId: { in: [...q.actor.branchIds] } } : {}),
    ...(!all && !branch ? { ownerUserId: q.actor.userId } : {}),
    ...(q.branchId ? { branchId: q.branchId } : {}),
  };
  const rows = await client.salesContract.findMany({
    where: {
      AND: [
        scope,
        {
          status: {
            in: [
              'CONFIRMED',
              'SENT_TO_RESERVATIONS',
              'IN_PROGRESS',
              'COMPLETED',
            ],
          },
          confirmedAt: { not: null, lt: q.to },
          payments: {
            some: {
              status: 'FINANCE_CONFIRMED',
              financeConfirmedAt: { not: null, lt: q.to },
            },
          },
        },
      ],
    },
    select: {
      customerId: true,
      destinationId: true,
      confirmedAt: true,
      services: { select: { kind: true } },
      payments: {
        where: {
          status: 'FINANCE_CONFIRMED',
          financeConfirmedAt: { not: null, lt: q.to },
        },
        select: {
          financeConfirmedAt: true,
          refunds: { where: { createdAt: { lt: q.to } }, select: { id: true } },
        },
      },
    },
    take: 10001,
  });
  if (rows.length > 10000)
    return { state: 'unavailable', reason: 'SOURCE_ROW_LIMIT' };
  const signals = [];
  for (const r of rows) {
    const paid = r.payments.flatMap((p) =>
      p.financeConfirmedAt ? [p.financeConfirmedAt.getTime()] : [],
    );
    if (!r.confirmedAt || !paid.length) continue;
    const at = new Date(Math.max(r.confirmedAt.getTime(), Math.min(...paid)));
    if (at < q.from || at >= q.to) continue;
    if (r.payments.some((p) => p.refunds.length))
      return {
        state: 'unsupported',
        reason: 'REFUND_SERVICE_ALLOCATION_REQUIRED',
      };
    for (const service of new Set(r.services.map((s) => s.kind)))
      signals.push({
        customerId: r.customerId,
        at,
        service,
        destinationId: r.destinationId,
      });
  }
  return { state: 'ready', signals };
}
