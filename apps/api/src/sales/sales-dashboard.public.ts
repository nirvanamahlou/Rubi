import { Inject, Injectable, Module } from '@nestjs/common';
import { Prisma, type SalesContractStatus } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import type {
  DashboardSourceQuery,
  DashboardSourceResult,
  DashboardObservation,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';
import { calculateSalesBalances } from './sales.domain';

/** Sales-owned contract/currency projection. No passenger/service joins multiply money. */
@Injectable()
export class SalesDashboardSource {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}
  async read(query: DashboardSourceQuery): Promise<DashboardSourceResult> {
    const source = 'sales.dashboard.contract-currency.v1';
    const permissions = query.actor.permissions;
    const all = permissions.includes('sales.contracts.read.all');
    const branch = permissions.includes('sales.contracts.read.branch');
    const own = permissions.includes('sales.contracts.read.own');
    if (!all && ((!branch && !own) || !query.actor.branchIds.length))
      return { source, state: 'forbidden', metrics: {} };
    if (
      unsupportedDashboardFilters(query, [
        'branch',
        'currencyCode',
        'status',
      ]) ||
      !['created', 'effective'].includes(query.dateBasis)
    )
      return {
        source,
        state: 'unsupported',
        reason: 'SALES_FILTER_OR_DATE_BASIS_UNSUPPORTED',
        metrics: {},
      };
    if (
      query.filters.status &&
      ![
        'CONFIRMED',
        'SENT_TO_RESERVATIONS',
        'IN_PROGRESS',
        'COMPLETED',
        'DRAFT',
        'CANCELLED',
      ].includes(query.filters.status)
    )
      return {
        source,
        state: 'unsupported',
        reason: 'SALES_STATUS_UNSUPPORTED',
        metrics: {},
      };
    const scope: Prisma.SalesContractWhereInput = {
      ...(!all ? { branchId: { in: [...query.actor.branchIds] } } : {}),
      ...(!all && !branch ? { ownerUserId: query.actor.userId } : {}),
    };
    const dateField =
      query.dateBasis === 'created' ? 'createdAt' : 'confirmedAt';
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
            [dateField]: { gte: query.from, lt: query.to },
          },
          ...(query.filters.status
            ? [{ status: query.filters.status as SalesContractStatus }]
            : []),
        ],
      },
      select: {
        createdAt: true,
        confirmedAt: true,
        priceComponents: {
          select: { type: true, title: true, amount: true, currencyCode: true },
        },
        payments: {
          where: { status: 'FINANCE_CONFIRMED' },
          select: {
            currencyCode: true,
            refunds: {
              where: { createdAt: { lt: query.to } },
              select: { amount: true },
            },
          },
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
    const gross: DashboardObservation[] = [],
      net: DashboardObservation[] = [];
    for (const row of rows) {
      const at =
        query.dateBasis === 'created' ? row.createdAt : row.confirmedAt!;
      const balances = calculateSalesBalances(
        row.priceComponents.map((component) => ({
          ...component,
          amount: component.amount.toString(),
        })),
        [],
      );
      for (const balance of balances) {
        if (
          query.filters.currencyCode &&
          query.filters.currencyCode !== balance.currencyCode
        )
          continue;
        const refunded = row.payments
          .filter((payment) => payment.currencyCode === balance.currencyCode)
          .flatMap((payment) => payment.refunds)
          .reduce(
            (sum, refund) => sum.plus(refund.amount),
            new Prisma.Decimal(0),
          );
        gross.push({
          at,
          currencyCode: balance.currencyCode,
          value: balance.amount,
        });
        net.push({
          at,
          currencyCode: balance.currencyCode,
          value: new Prisma.Decimal(balance.amount).minus(refunded).toString(),
        });
      }
    }
    return {
      source,
      state: 'ready',
      metrics: {
        'gross-sales': {
          kind: 'money',
          aggregation:
            'canonical confirmed contract sale total after source discounts, before completed refunds; CONTRACT_CURRENCY',
          observations: gross,
        },
        'net-sales': {
          kind: 'money',
          aggregation:
            'confirmed contract cohort sale total minus completed refunds allocated to those contracts before window end; CONTRACT_CURRENCY',
          observations: net,
        },
      },
    };
  }
}

@Module({ providers: [SalesDashboardSource], exports: [SalesDashboardSource] })
export class SalesDashboardPublicModule {}
