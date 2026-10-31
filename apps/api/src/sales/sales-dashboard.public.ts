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
        services: { select: { kind: true } },
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
    // New orders are a created-at cohort, independent of finalization. Do not
    // relabel finalized sales as new orders or require a confirmation date.
    const created = await this.db.client.salesContract.findMany({
      where: {
        AND: [
          scope,
          ...(query.branchId ? [{ branchId: query.branchId }] : []),
          { createdAt: { gte: query.from, lt: query.to } },
          ...(query.filters.status
            ? [{ status: query.filters.status as SalesContractStatus }]
            : []),
          ...(query.filters.currencyCode
            ? [
                {
                  priceComponents: {
                    some: { currencyCode: query.filters.currencyCode },
                  },
                },
              ]
            : []),
        ],
      },
      select: { createdAt: true },
      take: 10001,
    });
    if (created.length > 10000)
      return {
        source,
        state: 'unavailable',
        reason: 'SOURCE_ROW_LIMIT',
        metrics: {},
      };
    const gross: DashboardObservation[] = [],
      net: DashboardObservation[] = [],
      discounts: DashboardObservation[] = [],
      finalized: DashboardObservation[] = [];
    for (const row of rows) {
      const kinds = [
        ...new Set((row.services ?? []).map((service) => service.kind)),
      ].sort();
      const serviceLabels: Readonly<Record<string, string>> = {
        FLIGHT: 'پرواز',
        HOTEL: 'هتل',
        VISA: 'ویزا',
        INSURANCE: 'بیمه',
        TRANSFER: 'ترانسفر',
        TOUR: 'تور',
        BUS: 'اتوبوس',
        TRAIN: 'قطار',
        CIP: 'تشریفات فرودگاهی',
        OTHER: 'سایر خدمات',
      };
      const dimensions = {
        service:
          kinds.length > 1
            ? 'خدمات ترکیبی'
            : kinds.length === 1
              ? (serviceLabels[kinds[0]!] ?? kinds[0]!)
              : 'خدمت ثبت نشده',
      };
      const at =
        query.dateBasis === 'created' ? row.createdAt : row.confirmedAt!;
      const balances = calculateSalesBalances(
        row.priceComponents.map((component) => ({
          ...component,
          amount: component.amount.toString(),
        })),
        [],
      );
      if (
        !query.filters.currencyCode ||
        balances.some(
          (balance) => balance.currencyCode === query.filters.currencyCode,
        )
      )
        finalized.push({ at, value: '1' });
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
        const discount = row.priceComponents
          .filter(
            (component) =>
              component.type === 'DISCOUNT' &&
              component.currencyCode === balance.currencyCode,
          )
          .reduce(
            (total, component) => total.plus(component.amount.abs()),
            new Prisma.Decimal(0),
          );
        discounts.push({
          at,
          currencyCode: balance.currencyCode,
          value: discount.toString(),
        });
        gross.push({
          at,
          currencyCode: balance.currencyCode,
          value: new Prisma.Decimal(balance.amount).plus(discount).toString(),
        });
        net.push({
          at,
          currencyCode: balance.currencyCode,
          value: new Prisma.Decimal(balance.amount).minus(refunded).toString(),
          dimensions,
        });
      }
    }
    return {
      source,
      state: 'ready',
      metrics: {
        'new-orders': {
          kind: 'count',
          aggregation:
            'distinct contracts created in selected window, including draft and subsequently cancelled contracts; CREATED_AT',
          observations: created.map((row) => ({
            at: row.createdAt,
            value: '1',
          })),
        },
        'finalized-sales-count': {
          kind: 'count',
          aggregation:
            'distinct eligible confirmed contracts in selected date window; counted once across currencies',
          observations: finalized,
        },
        'discount-amount': {
          kind: 'money',
          aggregation:
            'absolute canonical DISCOUNT components on confirmed contracts; CONTRACT_CURRENCY',
          observations: discounts,
        },
        'gross-sales': {
          kind: 'money',
          aggregation:
            'canonical confirmed contract sale total before discounts and completed refunds; CONTRACT_CURRENCY',
          observations: gross,
        },
        'net-sales': {
          kind: 'money',
          aggregation:
            'confirmed contract cohort sale total minus completed refunds allocated to those contracts before window end; CONTRACT_CURRENCY',
          observations: net,
        },
        'average-sale-value': {
          kind: 'money',
          calculation: 'mean',
          aggregation:
            'net sale total divided by priced confirmed contracts in each source currency; recomputed from contract observations',
          observations: net,
        },
      },
    };
  }
}

@Module({ providers: [SalesDashboardSource], exports: [SalesDashboardSource] })
export class SalesDashboardPublicModule {}
