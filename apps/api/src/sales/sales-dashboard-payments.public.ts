import { Inject, Injectable, Module } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type {
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';

/** Sales owns receipt/refund records; confirmation is made by Finance, never inferred from scheduled payments. */
@Injectable()
export class SalesDashboardPayments {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async read(query: DashboardSourceQuery): Promise<DashboardSourceResult> {
    const source = 'sales.dashboard.confirmed-payments.v1';
    const p = query.actor.permissions;
    const all = p.includes('sales.contracts.read.all');
    const branch = p.includes('sales.contracts.read.branch');
    const own = p.includes('sales.contracts.read.own');
    if (
      !p.includes('sales.payments.read') ||
      (!all && ((!branch && !own) || !query.actor.branchIds.length))
    )
      return { source, state: 'forbidden', metrics: {} };
    if (unsupportedDashboardFilters(query, ['branch', 'currencyCode']))
      return {
        source,
        state: 'unsupported',
        reason: 'PAYMENT_FILTER_UNSUPPORTED',
        metrics: {},
      };
    const scope = {
      contract: {
        AND: [
          ...(!all
            ? [
                {
                  branchId: { in: [...query.actor.branchIds] },
                  ...(!branch ? { ownerUserId: query.actor.userId } : {}),
                },
              ]
            : []),
          ...(query.branchId ? [{ branchId: query.branchId }] : []),
        ],
      },
      ...(query.filters.currencyCode
        ? { currencyCode: query.filters.currencyCode }
        : {}),
    };
    const range = { gte: query.from, lt: query.to };
    const [receipts, refunds] = await Promise.all([
      this.db.client.salesContractPaymentEntry.findMany({
        where: {
          ...scope,
          status: 'FINANCE_CONFIRMED',
          financeConfirmedAt: { not: null, ...range },
        },
        select: { amount: true, currencyCode: true, financeConfirmedAt: true },
        take: 10001,
      }),
      this.db.client.salesPaymentRefund.findMany({
        where: { payment: scope, createdAt: range },
        select: {
          amount: true,
          createdAt: true,
          payment: { select: { currencyCode: true } },
        },
        take: 10001,
      }),
    ]);
    if (receipts.length > 10000 || refunds.length > 10000)
      return {
        source,
        state: 'unavailable',
        reason: 'SOURCE_ROW_LIMIT',
        metrics: {},
      };
    return {
      source,
      state: 'ready',
      metrics: {
        collected: {
          kind: 'money',
          aggregation:
            'Finance-confirmed receipt events by financeConfirmedAt; source currency; not scheduled payments or contract-date cohorts',
          observations: receipts.map((row) => ({
            at: row.financeConfirmedAt!,
            value: row.amount.toString(),
            currencyCode: row.currencyCode,
          })),
        },
        refunded: {
          kind: 'money',
          aggregation:
            'completed refund events by createdAt; one row per executed refund; source currency',
          observations: refunds.map((row) => ({
            at: row.createdAt,
            value: row.amount.toString(),
            currencyCode: row.payment.currencyCode,
          })),
        },
      },
    };
  }
}
@Module({
  providers: [SalesDashboardPayments],
  exports: [SalesDashboardPayments],
})
export class SalesDashboardPaymentsModule {}
