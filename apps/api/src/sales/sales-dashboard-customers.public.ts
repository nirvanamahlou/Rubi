import { Inject, Injectable, Module } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import {
  unsupportedDashboardFilters,
  type DashboardObservation,
  type DashboardSourceQuery,
  type DashboardSourceResult,
} from '../common/dashboard-source';

/** Sales-owned successful-purchase customer cohorts; no identity is returned. */
@Injectable()
export class SalesDashboardCustomers {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async read(query: DashboardSourceQuery): Promise<DashboardSourceResult> {
    const source = 'sales.dashboard.customer-purchase-cohorts.v1';
    const p = query.actor.permissions;
    const all = p.includes('sales.contracts.read.all');
    const branch = p.includes('sales.contracts.read.branch');
    if (
      !p.includes('customers.read') ||
      !p.includes('sales.payments.read') ||
      (!all &&
        ((!branch && !p.includes('sales.contracts.read.own')) ||
          !query.actor.branchIds.length))
    )
      return { source, state: 'forbidden', metrics: {} };
    // Restricting the purchase cohort by a service/status/currency can turn a
    // repeat buyer into a false first buyer. Such filters require another model.
    if (unsupportedDashboardFilters(query, ['branch']))
      return {
        source,
        state: 'unsupported',
        reason: 'CUSTOMER_COHORT_FILTER_UNSUPPORTED',
        metrics: {},
      };
    const scope: Prisma.SalesContractWhereInput = {
      ...(!all ? { branchId: { in: [...query.actor.branchIds] } } : {}),
      ...(!all && !branch ? { ownerUserId: query.actor.userId } : {}),
    };
    const rows = await this.db.client.salesContract.findMany({
      where: {
        AND: [
          scope,
          ...(query.branchId ? [{ branchId: query.branchId }] : []),
          {
            status: {
              in: [
                'CONFIRMED',
                'SENT_TO_RESERVATIONS',
                'IN_PROGRESS',
                'COMPLETED',
              ],
            },
            confirmedAt: { not: null, lt: query.to },
            payments: {
              some: {
                status: 'FINANCE_CONFIRMED',
                financeConfirmedAt: { not: null, lt: query.to },
              },
            },
          },
        ],
      },
      select: {
        customerId: true,
        confirmedAt: true,
        payments: {
          where: {
            status: 'FINANCE_CONFIRMED',
            financeConfirmedAt: { not: null, lt: query.to },
          },
          select: { financeConfirmedAt: true },
        },
      },
      take: 10001,
    });
    if (rows.length > 10000)
      return {
        source,
        state: 'unavailable',
        reason: 'SOURCE_ROW_LIMIT',
        metrics: {},
      };
    const purchases = new Map<string, Date[]>();
    for (const row of rows) {
      const paid = row.payments
        .map((payment) => payment.financeConfirmedAt!)
        .sort((a, b) => a.getTime() - b.getTime())[0];
      if (!paid || !row.confirmedAt) continue;
      const at = new Date(Math.max(paid.getTime(), row.confirmedAt.getTime()));
      if (at >= query.to) continue;
      purchases.set(row.customerId, [
        ...(purchases.get(row.customerId) ?? []),
        at,
      ]);
    }
    const fresh: DashboardObservation[] = [],
      returning: DashboardObservation[] = [];
    for (const dates of purchases.values()) {
      dates.sort((a, b) => a.getTime() - b.getTime());
      const current = dates.find((date) => date >= query.from);
      if (!current) continue;
      (dates[0]! < query.from ? returning : fresh).push({
        at: current,
        value: '1',
      });
    }
    return {
      source,
      state: 'ready',
      metrics: {
        'new-customers': {
          kind: 'count',
          aggregation:
            'distinct first successful paid-purchase customers within authorized Sales scope; later of contract confirmation and first Finance receipt confirmation',
          observations: fresh,
        },
        'returning-customers': {
          kind: 'count',
          aggregation:
            'distinct customers with a successful purchase before window and another in window within authorized Sales scope; once per customer',
          observations: returning,
        },
      },
    };
  }
}
@Module({
  providers: [SalesDashboardCustomers],
  exports: [SalesDashboardCustomers],
})
export class SalesDashboardCustomersModule {}
