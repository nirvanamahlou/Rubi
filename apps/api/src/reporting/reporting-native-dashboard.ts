import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Prisma } from '@nora/database';
import type {
  DashboardObservation,
  DashboardSourceMetric,
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { SalesDashboardSource } from '../sales/sales-dashboard.public';
import { CustomerDashboardSource } from '../customers/customer-dashboard.public';
import { LeadDashboardSource } from '../customer-affairs/lead-dashboard.public';
import { IamFinanceDirectory } from '../iam/iam-finance-directory';
import {
  dashboardCalendarRangeStart,
  dashboardTrendBucketStarts,
} from './reporting-dashboard-calendar';
import type { DashboardProjectionV1 } from './reporting.contracts';
import type { ReportingActor } from './reporting.service';

const emptyOptions = () => ({
  salesChannel: [],
  branch: [],
  agent: [],
  service: [],
  agency: [],
  provider: [],
  currency: [],
  status: [],
});
const sum = (rows: readonly DashboardObservation[]) =>
  rows.reduce((value, row) => value.plus(row.value), new Prisma.Decimal(0));
function exactText(value: Prisma.Decimal) {
  const [integer, fraction] = value
    .toFixed(4)
    .replace(/\.?0+$/, '')
    .split('.');
  // No conversion of Decimal money to binary floating point for the displayed total.
  return (
    (value.isNegative() && integer === '-0' ? '−' : '') +
    BigInt(integer || '0').toLocaleString('fa-IR') +
    (fraction
      ? '٫' + fraction.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!)
      : '')
  );
}
function comparison(current: Prisma.Decimal, previous: Prisma.Decimal) {
  return {
    label: 'دوره قبل هم‌طول' as const,
    previousValue: previous.toNumber(),
    deltaPercent: previous.isZero()
      ? null
      : current
          .minus(previous)
          .div(previous.abs())
          .mul(100)
          .toDecimalPlaces(1)
          .toNumber(),
    direction: current.gt(previous)
      ? ('up' as const)
      : current.lt(previous)
        ? ('down' as const)
        : ('flat' as const),
  };
}

@Injectable()
export class ReportingNativeDashboard {
  constructor(
    @Inject(SalesDashboardSource) private readonly sales: SalesDashboardSource,
    @Inject(CustomerDashboardSource)
    private readonly customers: CustomerDashboardSource,
    @Inject(LeadDashboardSource) private readonly leads: LeadDashboardSource,
    @Inject(IamFinanceDirectory)
    private readonly identities: IamFinanceDirectory,
  ) {}
  async load(
    input: Record<string, string | undefined>,
    actor: ReportingActor,
    filters: Readonly<Record<string, string>>,
    now: Date,
  ): Promise<DashboardProjectionV1> {
    const branches = await this.identities.branches([...actor.branchIds]);
    const selected = filters.branch
      ? branches.find(
          (branch) =>
            branch.name === filters.branch || branch.id === filters.branch,
        )
      : undefined;
    if (filters.branch && !selected)
      throw new ForbiddenException('شعبه داشبورد خارج از دسترسی مجاز است.');
    const from = filters.fromUtc
      ? new Date(filters.fromUtc)
      : dashboardCalendarRangeStart(now, 'month');
    const to = new Date(filters.toUtc ?? now.toISOString());
    const duration = to.getTime() - from.getTime();
    const sourceFilters = Object.fromEntries(
      Object.entries(filters).filter(
        ([key]) => !['fromUtc', 'toUtc'].includes(key),
      ),
    );
    // Legal Entity is issuer context, not operational ownership (MODULE_BOUNDARIES).
    // Preserve each producer's permission/branch scope; never infer an issuer FK.
    const query: DashboardSourceQuery = {
      actor,
      from,
      to,
      ...(selected ? { branchId: selected.id } : {}),
      filters: sourceFilters,
      dateBasis: input.dateBasis ?? 'effective',
    };
    const readers = [this.sales, this.customers, this.leads];
    const read = async (request: DashboardSourceQuery) => {
      const results = await Promise.allSettled(
        readers.map((reader) => reader.read(request)),
      );
      return results.map((result, index): DashboardSourceResult =>
        result.status === 'fulfilled'
          ? result.value
          : {
              source: [
                'sales.dashboard.contract-currency.v1',
                'customers.dashboard.registrations.v1',
                'customer-affairs.dashboard.leads.v1',
              ][index]!,
              state: 'unavailable',
              reason: 'SOURCE_READ_FAILED',
              metrics: {},
            },
      );
    };
    const [current, previous] = await Promise.all([
      read(query),
      duration > 0
        ? read({
            ...query,
            from: new Date(from.getTime() - duration),
            to: from,
          })
        : Promise.resolve([]),
    ]);
    const available = Object.assign(
      {},
      ...current
        .filter((result) => result.state === 'ready')
        .map((result) => result.metrics),
    ) as Record<string, DashboardSourceMetric>;
    const prior = Object.assign(
      {},
      ...previous
        .filter((result) => result.state === 'ready')
        .map((result) => result.metrics),
    ) as Record<string, DashboardSourceMetric>;
    const requested = (input.kpiIds ?? Object.keys(available).join(','))
      .split(',')
      .filter(Boolean);
    const visualIds = (input.visualIds ?? '').split(',');
    const calculated = new Set(requested);
    if (visualIds.includes('revenue-collections')) calculated.add('net-sales');
    const starts =
      duration > 0
        ? dashboardTrendBucketStarts({
            from,
            to,
            range: input.range as
              | 'today'
              | 'week'
              | 'month'
              | 'quarter'
              | 'year'
              | 'custom'
              | undefined,
          })
        : [];
    const labels = starts.map((date) =>
      new Intl.DateTimeFormat('fa-IR', {
        timeZone: 'Asia/Tehran',
        month: 'short',
        day: 'numeric',
      }).format(date),
    );
    const trend = (rows: readonly DashboardObservation[]) => ({
      labels,
      values: starts.map((start, index) =>
        sum(
          rows.filter(
            (row) => row.at >= start && row.at < (starts[index + 1] ?? to),
          ),
        ).toNumber(),
      ),
    });
    const metrics: Record<string, DashboardProjectionV1['metrics'][string]> =
      {};
    const unavailableMetrics: Record<string, string> = {};
    for (const id of calculated) {
      const metric = available[id];
      if (!metric) {
        unavailableMetrics[id] = 'SOURCE_OR_SCOPE_UNAVAILABLE';
        continue;
      }
      const old = prior[id];
      const codes = [
        ...new Set(
          metric.observations.flatMap((row) =>
            row.currencyCode ? [row.currencyCode] : [],
          ),
        ),
      ].sort();
      const total =
        metric.kind === 'count'
          ? sum(metric.observations)
          : new Prisma.Decimal(0);
      const monetary = metric.kind === 'money';
      const safe = (rows: readonly DashboardObservation[]) =>
        rows.every((row) =>
          new Prisma.Decimal(row.value).abs().lte(Number.MAX_SAFE_INTEGER),
        ) && sum(rows).abs().lte(Number.MAX_SAFE_INTEGER);
      const comparisonSeries =
        monetary && old
          ? codes
              .filter(
                (code) =>
                  safe(
                    metric.observations.filter(
                      (row) => row.currencyCode === code,
                    ),
                  ) &&
                  safe(
                    old.observations.filter((row) => row.currencyCode === code),
                  ),
              )
              .map((code) => ({
                currencyCode: code,
                ...comparison(
                  sum(
                    metric.observations.filter(
                      (row) => row.currencyCode === code,
                    ),
                  ),
                  sum(
                    old.observations.filter((row) => row.currencyCode === code),
                  ),
                ),
              }))
          : [];
      metrics[id] = {
        value: monetary
          ? codes
              .map(
                (code) =>
                  exactText(
                    sum(
                      metric.observations.filter(
                        (row) => row.currencyCode === code,
                      ),
                    ),
                  ) +
                  ' ' +
                  code,
              )
              .join(' · ') || '۰'
          : total.toFixed(0).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!),
        unit: monetary ? 'ارزهای مستقل' : 'تعداد',
        detail: metric.aggregation,
        metricId: id,
        aggregation: metric.aggregation,
        ...(monetary
          ? comparisonSeries.length
            ? {
                comparisonSeries,
                ...(comparisonSeries.length === 1
                  ? { comparison: comparisonSeries[0] }
                  : {}),
              }
            : {}
          : old && safe(metric.observations) && safe(old.observations)
            ? { comparison: comparison(total, sum(old.observations)) }
            : {}),
        ...(starts.length &&
        (monetary
          ? codes.every((code) =>
              safe(
                metric.observations.filter((row) => row.currencyCode === code),
              ),
            )
          : safe(metric.observations))
          ? {
              trend: monetary
                ? {
                    labels,
                    values: codes.length
                      ? trend(
                          metric.observations.filter(
                            (row) => row.currencyCode === codes[0],
                          ),
                        ).values
                      : starts.map(() => 0),
                    series: codes.map((currencyCode) => ({
                      currencyCode,
                      values: trend(
                        metric.observations.filter(
                          (row) => row.currencyCode === currencyCode,
                        ),
                      ).values,
                    })),
                  }
                : trend(metric.observations),
            }
          : {}),
      };
    }
    const visuals: Record<string, DashboardProjectionV1['visuals'][string]> =
      {};
    const net = metrics['net-sales'];
    if (visualIds.includes('revenue-collections') && net?.trend) {
      const series = net.trend.series ?? [];
      visuals['revenue-collections'] = {
        labels,
        values: net.trend.values,
        unit: 'فروش خالص؛ ارزهای مستقل',
        currencySeries: series.map((row) => ({
          currencyCode: row.currencyCode,
          labels,
          values: row.values,
        })),
      };
    }
    for (const id of Object.keys(metrics)) {
      if (!requested.includes(id)) delete metrics[id];
    }
    const partial =
      Object.keys(unavailableMetrics).length > 0 ||
      current.some((result) => result.state !== 'ready');
    return {
      state:
        Object.keys(metrics).length || Object.keys(visuals).length
          ? 'ready'
          : 'blocked',
      message: partial
        ? 'بخشی از شاخص‌ها به منبع معتبر یا دسترسی لازم متصل نیستند؛ شاخص‌های موجود از دادهٔ واقعی محاسبه شده‌اند.'
        : 'دادهٔ واقعی ماژول‌های ERP؛ بدون تبدیل ارز. شرکت صادرکننده دامنهٔ دادهٔ عملیاتی را تغییر نمی‌دهد.',
      metadata: {
        generatedAt: now.toISOString(),
        dataAsOf: now.toISOString(),
        timezone: 'Asia/Tehran',
        dateBasis:
          'SOURCE_DEFINED: confirmed contract cohort / customer and lead registration',
        currencyFxBasis: 'SOURCE_CURRENCY_NO_CONVERSION',
        reportVersion: 'reporting.dashboard.native.v1',
        permissionSnapshot: createHash('sha256')
          .update(
            JSON.stringify({
              userId: actor.userId,
              permissions: [...actor.permissions].sort(),
              branches: [...actor.branchIds].sort(),
            }),
          )
          .digest('hex'),
      },
      filterOptions: {
        ...emptyOptions(),
        branch: branches.map((branch) => branch.name),
        currency: [
          ...new Set(
            Object.values(available).flatMap((metric) =>
              metric.observations.flatMap((row) =>
                row.currencyCode ? [row.currencyCode] : [],
              ),
            ),
          ),
        ].sort(),
        status: [
          'CONFIRMED',
          'SENT_TO_RESERVATIONS',
          'IN_PROGRESS',
          'COMPLETED',
          'DRAFT',
          'CANCELLED',
        ],
      },
      metrics,
      visuals,
      unavailableMetrics,
      sourceCoverage: current.map((result) => ({
        source: result.source,
        state: result.state,
        ...(result.reason ? { reason: result.reason } : {}),
      })),
    };
  }
}
