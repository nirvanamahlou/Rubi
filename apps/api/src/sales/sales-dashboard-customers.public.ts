import { Inject, Injectable, Module } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import {
  unsupportedDashboardFilters,
  type DashboardObservation,
  type DashboardSourceQuery,
  type DashboardSourceResult,
} from '../common/dashboard-source';

type PurchaseHistory =
  | {
      state: 'ready';
      rows: {
        id: string;
        customerId: string;
        confirmedAt: Date | null;
        payments: { financeConfirmedAt: Date | null }[];
      }[];
    }
  | { state: 'forbidden' | 'unsupported' | 'unavailable'; reason?: string };
type LeadReferences = {
  customerIds: readonly string[];
  contractIds: readonly string[];
};

/** Sales-owned paid-purchase cohorts. HTTP aggregates contain no identities. */
@Injectable()
export class SalesDashboardCustomers {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async read(query: DashboardSourceQuery): Promise<DashboardSourceResult> {
    const source = 'sales.dashboard.customer-purchase-cohorts.v1';
    const history = await this.history(query);
    if (history.state !== 'ready') return { source, ...history, metrics: {} };
    const rows = history.rows;
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
      if (current)
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
            'distinct first successful paid-purchase customers within authorized Sales scope; later of contract confirmation and first Finance receipt confirmation; historical paid purchases retained after cancellation',
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

  /** Additive internal v1 boundary for canonical lead conversion; no contact data. */
  async convertedLeadReferencesV1(
    query: DashboardSourceQuery,
    references: LeadReferences,
  ) {
    const history = await this.history(query, references);
    if (history.state !== 'ready')
      return { ...history, customerIds: [], contractIds: [] };
    return {
      state: 'ready' as const,
      customerIds: [...new Set(history.rows.map((row) => row.customerId))],
      contractIds: [...new Set(history.rows.map((row) => row.id))],
    };
  }

  private async history(
    query: DashboardSourceQuery,
    references?: LeadReferences,
  ): Promise<PurchaseHistory> {
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
      return { state: 'forbidden' };
    // Restricting the purchase cohort by a service/status/currency can turn a
    // repeat buyer into a false first buyer. Such filters require another model.
    if (unsupportedDashboardFilters(query, ['branch']))
      return {
        state: 'unsupported',
        reason: 'CUSTOMER_COHORT_FILTER_UNSUPPORTED',
      };
    const scope: Prisma.SalesContractWhereInput = {
      ...(!all ? { branchId: { in: [...query.actor.branchIds] } } : {}),
      ...(!all && !branch ? { ownerUserId: query.actor.userId } : {}),
    };
    if (
      references &&
      references.customerIds.length + references.contractIds.length > 10000
    )
      return { state: 'unavailable', reason: 'SOURCE_ROW_LIMIT' };
    if (
      references &&
      !references.customerIds.length &&
      !references.contractIds.length
    )
      return { state: 'ready', rows: [] };
    const rows = await this.db.client.salesContract.findMany({
      where: {
        AND: [
          scope,
          ...(query.branchId ? [{ branchId: query.branchId }] : []),
          ...(references
            ? [
                {
                  OR: [
                    { customerId: { in: [...references.customerIds] } },
                    { id: { in: [...references.contractIds] } },
                  ],
                },
              ]
            : []),
          {
            status: {
              in: [
                'CONFIRMED',
                'SENT_TO_RESERVATIONS',
                'IN_PROGRESS',
                'COMPLETED',
                'CANCELLED',
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
        id: true,
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
        state: 'unavailable',
        reason: 'SOURCE_ROW_LIMIT',
      };
    return { state: 'ready', rows };
  }
}
@Module({
  providers: [SalesDashboardCustomers],
  exports: [SalesDashboardCustomers],
})
export class SalesDashboardCustomersModule {}
