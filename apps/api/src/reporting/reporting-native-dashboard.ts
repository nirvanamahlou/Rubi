import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
} from '@nestjs/common';
import { SalesDashboardPayments } from '../sales/sales-dashboard-payments.public';
import { SalesDashboardCustomers } from '../sales/sales-dashboard-customers.public';
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
// Metric series inside a currency must never be confused with currency series.
const trendVisuals: Readonly<Record<string, readonly string[]>> = {
  'revenue-collections': ['net-sales'], // legacy client identifier
  'executive-trend': ['net-sales', 'collected', 'gross-profit'],
  'sales-collection-trend': ['net-sales', 'collected', 'refunded'],
  'finalized-sales-trend': ['net-sales'],
  'discount-trend': ['discount-amount'],
  'executive-lead-acquisition': ['new-leads'],
  'executive-customer-retention': ['new-customers', 'returning-customers'],
};
const metricLabels: Readonly<Record<string, string>> = {
  'net-sales': 'فروش خالص',
  collected: 'وصول تأییدشده',
  refunded: 'استرداد تکمیل‌شده',
  'gross-profit': 'سود ناخالص',
  'discount-amount': 'تخفیف',
  'new-leads': 'لید جدید',
  'new-customers': 'مشتری با اولین خرید تأییدشده',
  'returning-customers': 'مشتری بازگشتی',
  'average-sale-value': 'میانگین مبلغ فروش',
};
const serviceVisualIds = new Set([
  'executive-sales-by-service',
  'service-type',
  'service-sales-portfolio',
]);
const breakdownVisualIds = new Set([
  ...serviceVisualIds,
  'sales-weekday-pattern',
]);
const postedAccountingMetricIds = new Set([
  'account-balance',
  'receivables',
  'overdue-balance',
  'net-profit',
  'operating-expenses',
]);
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
    @Optional()
    @Inject(SalesDashboardPayments)
    private readonly payments?: SalesDashboardPayments,
    @Optional()
    @Inject(SalesDashboardCustomers)
    private readonly customerPurchases?: SalesDashboardCustomers,
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
    const readers = [
      this.sales,
      this.customers,
      this.leads,
      ...(this.payments ? [this.payments] : []),
      ...(this.customerPurchases ? [this.customerPurchases] : []),
    ];
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
                'sales.dashboard.confirmed-payments.v1',
                'sales.dashboard.customer-purchase-cohorts.v1',
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
    const visualIds = (input.visualIds ?? '').split(',').filter(Boolean);
    const calculated = new Set(requested);
    if (calculated.has('lead-growth-rate')) calculated.add('new-leads');
    for (const id of visualIds)
      for (const metric of trendVisuals[id] ?? []) calculated.add(metric);
    if (visualIds.some((id) => breakdownVisualIds.has(id)))
      calculated.add('net-sales');
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
    const aggregate = (rows: readonly DashboardObservation[], mean = false) =>
      mean && rows.length ? sum(rows).div(rows.length) : sum(rows);
    const trend = (rows: readonly DashboardObservation[], mean = false) => ({
      labels,
      values: starts.map((start, index) =>
        aggregate(
          rows.filter(
            (row) => row.at >= start && row.at < (starts[index + 1] ?? to),
          ),
          mean,
        ).toNumber(),
      ),
    });
    const metrics: Record<string, DashboardProjectionV1['metrics'][string]> =
      {};
    const unavailableMetrics: Record<string, string> = {};
    for (const id of calculated) {
      const metric = available[id];
      if (!metric) {
        unavailableMetrics[id] =
          id === 'gross-profit'
            ? 'APPROVED_MATCHED_COST_REQUIRED'
            : postedAccountingMetricIds.has(id)
              ? 'POSTED_ACCOUNTING_SOURCE_REQUIRED'
              : 'SOURCE_OR_SCOPE_UNAVAILABLE';
        continue;
      }
      const old = prior[id];
      const mean = metric.calculation === 'mean';
      if (mean && !metric.observations.length) {
        unavailableMetrics[id] = 'ZERO_DENOMINATOR';
        continue;
      }
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
                  ) &&
                  (!mean ||
                    old.observations.some((row) => row.currencyCode === code)),
              )
              .map((code) => ({
                currencyCode: code,
                ...comparison(
                  aggregate(
                    metric.observations.filter(
                      (row) => row.currencyCode === code,
                    ),
                    mean,
                  ),
                  aggregate(
                    old.observations.filter((row) => row.currencyCode === code),
                    mean,
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
                    aggregate(
                      metric.observations.filter(
                        (row) => row.currencyCode === code,
                      ),
                      mean,
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
        ...(!mean &&
        starts.length &&
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
                          mean,
                        ).values
                      : starts.map(() => 0),
                    series: codes.map((currencyCode) => ({
                      currencyCode,
                      values: trend(
                        metric.observations.filter(
                          (row) => row.currencyCode === currencyCode,
                        ),
                        mean,
                      ).values,
                    })),
                  }
                : trend(metric.observations),
            }
          : {}),
      };
    }
    if (calculated.has('lead-growth-rate')) {
      const current = available['new-leads'],
        before = prior['new-leads'];
      if (current && before) {
        const denominator = sum(before.observations);
        if (denominator.isZero())
          unavailableMetrics['lead-growth-rate'] = 'ZERO_DENOMINATOR';
        else {
          const growth = sum(current.observations)
            .minus(denominator)
            .div(denominator)
            .mul(100);
          metrics['lead-growth-rate'] = {
            value: exactText(growth.toDecimalPlaces(1)),
            unit: 'درصد',
            metricId: 'lead-growth-rate',
            detail:
              'تغییر تعداد لیدهای بدون خرید موفق نسبت به دورهٔ قبل هم‌طول؛ وضعیت تبدیل در پایان هر دوره سنجیده می‌شود.',
          };
          delete unavailableMetrics['lead-growth-rate'];
        }
      }
    }
    const visuals: Record<string, DashboardProjectionV1['visuals'][string]> =
      {};
    const unavailableVisuals: Record<string, string> = {};
    for (const id of visualIds) {
      if (breakdownVisualIds.has(id)) {
        const source = available['net-sales'];
        if (!source) {
          unavailableVisuals[id] = 'SOURCE_OR_SCOPE_UNAVAILABLE';
          continue;
        }
        const codes = [
          ...new Set(
            source.observations
              .map((row) => row.currencyCode)
              .filter((code): code is string => Boolean(code)),
          ),
        ].sort();
        const weekdays = [
          'شنبه',
          'یکشنبه',
          'دوشنبه',
          'سه‌شنبه',
          'چهارشنبه',
          'پنجشنبه',
          'جمعه',
        ];
        const weekday = new Intl.DateTimeFormat('fa-IR', {
          timeZone: 'Asia/Tehran',
          weekday: 'long',
        });
        const category = (row: DashboardObservation) =>
          id === 'sales-weekday-pattern'
            ? weekday.format(row.at)
            : (row.dimensions?.service ?? 'خدمت ثبت نشده');
        const currencySeries = codes.map((currencyCode) => {
          const rows = source.observations.filter(
            (row) => row.currencyCode === currencyCode,
          );
          const labels =
            id === 'sales-weekday-pattern'
              ? weekdays
              : [
                  ...new Set(
                    rows.map(
                      (row) => row.dimensions?.service ?? 'خدمت ثبت نشده',
                    ),
                  ),
                ].sort();
          const totals = labels.map((label) =>
            sum(rows.filter((row) => category(row) === label)),
          );
          return {
            currencyCode,
            labels,
            values: totals.map((value) => value.toNumber()),
            safe: totals.every((value) =>
              value.abs().lte(Number.MAX_SAFE_INTEGER),
            ),
          };
        });
        if (currencySeries.some((series) => !series.safe)) {
          unavailableVisuals[id] = 'CHART_NUMERIC_RANGE';
          continue;
        }
        visuals[id] = {
          labels: currencySeries[0]?.labels ?? [],
          values: currencySeries[0]?.values ?? [],
          currencySeries: currencySeries.map(
            ({ currencyCode, labels, values }) => ({
              currencyCode,
              labels,
              values,
            }),
          ),
          unit: 'فروش خالص',
          notice:
            id === 'sales-weekday-pattern'
              ? 'مبلغ فروش خالص به تفکیک روز هفته در زمان تهران؛ روزهای بازهٔ انتخابی با هم جمع می‌شوند و تعداد فروش روی این محور نیست.'
              : 'قرارداد چندخدمتیِ فاقد تفکیک مبلغ، یک بار در خدمات ترکیبی محاسبه می‌شود.',
        };
        continue;
      }
      const ids = trendVisuals[id] ?? [];
      const usable = ids.filter((metric) => metrics[metric]?.trend);
      if (!usable.length) {
        unavailableVisuals[id] = 'SOURCE_OR_SCOPE_UNAVAILABLE';
        continue;
      }
      const missing = ids.filter((metric) => !usable.includes(metric));
      const money = available[usable[0]!]!.kind === 'money';
      const codes = [
        ...new Set(
          usable.flatMap(
            (metric) =>
              metrics[metric]!.trend!.series?.map(
                (series) => series.currencyCode,
              ) ?? [],
          ),
        ),
      ].sort();
      // An authorized empty event source is a true zero for each currency
      // found in another authorized source. A missing source is never zero.
      const seriesFor = (code?: string) =>
        usable.map((metric) => ({
          label: metricLabels[metric] ?? metric,
          values: code
            ? (metrics[metric]!.trend!.series?.find(
                (series) => series.currencyCode === code,
              )?.values ?? starts.map(() => 0))
            : metrics[metric]!.trend!.values,
        }));
      const currencySeries = codes.map((currencyCode) => {
        const series = seriesFor(currencyCode);
        return { currencyCode, labels, values: series[0]!.values, series };
      });
      const series = seriesFor();
      const notices = [
        ...(missing.length
          ? [
              `سری‌های فاقد منبع معتبر یا دسترسی: ${missing.map((metric) => metricLabels[metric] ?? metric).join('، ')}؛ این سری‌ها صفر فرض نشده‌اند.`,
            ]
          : []),
        ...(id === 'finalized-sales-trend'
          ? [
              'این نمودار مبلغ فروش خالص را نشان می‌دهد؛ تعداد فروش در کارت مستقل نمایش داده می‌شود تا تعداد و مبلغ روی یک محور ادغام نشوند.',
            ]
          : []),
      ];
      visuals[id] = {
        labels,
        values: currencySeries[0]?.values ?? series[0]!.values,
        unit: money ? 'مبلغ؛ ارزهای مستقل' : 'تعداد',
        ...(money ? { currencySeries } : { series }),
        ...(notices.length ? { notice: notices.join(' ') } : {}),
      };
    }
    for (const id of Object.keys(metrics)) {
      if (!requested.includes(id)) delete metrics[id];
    }
    const partial =
      Object.keys(unavailableMetrics).length > 0 ||
      Object.keys(unavailableVisuals).length > 0 ||
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
          'SOURCE_DEFINED: confirmed contract cohort / customer and lead registration / confirmed receipt and executed refund event',
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
      unavailableVisuals,
      sourceCoverage: current.map((result) => ({
        source: result.source,
        state: result.state,
        ...(result.reason ? { reason: result.reason } : {}),
      })),
    };
  }
}
