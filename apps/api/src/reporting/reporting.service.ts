import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ReportingExportService } from './reporting-export.service';
import {
  dashboardCalendarRangeStart,
  dashboardTrendBucketStarts,
} from './reporting-dashboard-calendar';
import { REPORTING_CATALOG_V1 } from './reporting.catalog';
import type {
  ReportQueryV1,
  ReportingExportRequestV1,
  TravelReportResultV1,
  DashboardProjectionV1,
} from './reporting.contracts';
import { buildTravelReportResult } from './reporting.projection';
import {
  ReportingRepository,
  type DashboardFilterOptions,
  type ReportingFactRow,
} from './reporting.repository';
import {
  MAX_PREVIEW_PAGE_SIZE,
  validateExportRequest,
  validateReportQuery,
} from './reporting.policy';

export interface ReportingActor {
  userId: string;
  permissions: readonly string[];
  branchIds: readonly string[];
}

const dashboardFilterOptionsFromRows = (
  rows: readonly ReportingFactRow[],
): DashboardFilterOptions => {
  const options = (pick: (row: ReportingFactRow) => string | null) =>
    Object.freeze(
      [
        ...new Set(
          rows
            .map(pick)
            .filter(
              (value): value is string =>
                typeof value === 'string' && value.length > 0,
            ),
        ),
      ].sort((a, b) => a.localeCompare(b, 'fa')),
    );
  return {
    salesChannel: options((row) => row.salesChannel),
    branch: options((row) => row.branchName),
    agent: options((row) => row.ownerName),
    service: options((row) => row.serviceType),
    agency: options((row) => row.agencyName),
    provider: options((row) => row.providerName),
    currency: options((row) => row.currencyCode),
    status: options((row) => row.orderStatus),
  };
};

const UNRELEASED_REPORT_CODES = new Set([
  'sales_contract_pipeline',
  'agency_contract_risk',
  'ticket_capacity',
  'supplier_payment_queue',
  'reservation_delivery_readiness',
  'lead_pipeline',
  'customer_satisfaction',
  'customer_consent_coverage',
  'document_compliance',
  'hr_record_expiry',
  'workbench_due_actions',
  'hotel_rate_comparison',
  'future_travel_commitments',
  'customer_payment_aging',
  'reservation_cycle_time',
  'manifest_finance_exclusions',
  'customer_portfolio_growth',
]);

@Injectable()
export class ReportingService {
  constructor(
    @Optional()
    @Inject(ReportingRepository)
    private readonly repository?: ReportingRepository,
    @Optional()
    @Inject(ReportingExportService)
    private readonly exportFiles?: ReportingExportService,
  ) {}

  private hasSalesRead(actor: ReportingActor): boolean {
    return [
      'sales.contracts.read.all',
      'sales.contracts.read.branch',
      'sales.contracts.read.own',
    ].some((permission) => actor.permissions.includes(permission));
  }

  private canReadReport(actor: ReportingActor, permission: string): boolean {
    return (
      actor.permissions.includes(permission) ||
      (permission === 'reporting.sales.read' && this.hasSalesRead(actor))
    );
  }

  private require(actor: ReportingActor, permission: string): void {
    if (!this.canReadReport(actor, permission))
      throw new ForbiddenException('دسترسی گزارش مجاز نیست.');
  }

  private requireShare(actor: ReportingActor): void {
    if (
      !actor.permissions.includes('reporting.share') &&
      !actor.permissions.includes('reporting.manage')
    )
      throw new ForbiddenException('مجوز اشتراک‌گذاری گزارش وجود ندارد.');
  }

  catalog(actor: ReportingActor) {
    if (
      !actor.permissions.includes('reporting.read') &&
      !this.hasSalesRead(actor)
    )
      throw new ForbiddenException('دسترسی گزارش مجاز نیست.');
    return REPORTING_CATALOG_V1.filter((report) =>
      this.canReadReport(actor, report.permission),
    );
  }

  metadata(code: string, actor: ReportingActor) {
    const report =
      REPORTING_CATALOG_V1.find((item) => item.code === code) ??
      (UNRELEASED_REPORT_CODES.has(code)
        ? {
            code,
            title: `گزارش عملیاتی ${code}`,
            grain: 'ORDER_ITEM_CURRENCY' as const,
            permission: 'reporting.read',
            producerStatus: 'PENDING_CONNECTION' as const,
            approvedView: `reporting_${code}_facts_v1`,
            outputs: ['XLSX', 'PDF', 'CSV', 'API'] as const,
            version: 1,
          }
        : undefined);
    if (!report) throw new NotFoundException('گزارش پیدا نشد.');
    if (
      !actor.permissions.includes('reporting.read') &&
      !(
        report.permission === 'reporting.sales.read' && this.hasSalesRead(actor)
      )
    )
      throw new ForbiddenException('دسترسی گزارش مجاز نیست.');
    this.require(actor, report.permission);
    return report;
  }

  async query(
    code: string,
    input: ReportQueryV1,
    actor: ReportingActor,
  ): Promise<TravelReportResultV1> {
    return this.preview(code, input, actor);
  }

  async preview(
    code: string,
    input: ReportQueryV1,
    actor: ReportingActor,
  ): Promise<TravelReportResultV1> {
    return this.previewWithHistory(code, input, actor, false);
  }

  async previewRun(
    code: string,
    input: ReportQueryV1,
    actor: ReportingActor,
  ): Promise<TravelReportResultV1> {
    return this.previewWithHistory(code, input, actor, true);
  }

  private async previewWithHistory(
    code: string,
    input: ReportQueryV1,
    actor: ReportingActor,
    recordAction: boolean,
  ): Promise<TravelReportResultV1> {
    const report = this.metadata(code, actor);
    if (report.producerStatus === 'READY') {
      const serverBranchScope =
        actor.permissions.includes('sales.contracts.read.all') ||
        actor.permissions.includes('reporting.read')
          ? []
          : actor.branchIds;
      const query = validateReportQuery(
        { ...input, branchIds: serverBranchScope },
        MAX_PREVIEW_PAGE_SIZE,
      );
      if (!this.repository)
        throw new ConflictException('Persistence گزارش در دسترس نیست.');
      const started = Date.now();
      const run = recordAction
        ? await this.repository.createRun({
            reportCode: code,
            actorUserId: actor.userId,
            filterSnapshot: { ...query, actionType: 'PREVIEW' },
            viewName: report.approvedView,
            viewVersion: report.version,
          })
        : null;
      try {
        const facts = await this.repository.facts(query, serverBranchScope);
        const result = buildTravelReportResult({
          code,
          query,
          facts,
          now: new Date(),
        });
        if (run)
          await this.repository.finishRun(
            String(run.id),
            result.total,
            Date.now() - started,
          );
        return result;
      } catch (error) {
        if (run)
          await this.repository.failRun(
            String(run.id),
            'نمایش نتیجه ناموفق بود.',
            Date.now() - started,
          );
        throw error;
      }
    }
    throw new ConflictException(
      `Approved View ${report.approvedView} هنوز توسط مالک دامنه منتشر نشده است.`,
    );
  }

  export(input: ReportingExportRequestV1, actor: ReportingActor): never {
    const report = this.metadata(input.reportCode, actor);
    this.require(actor, 'reporting.export');
    validateExportRequest(input, actor.permissions);
    throw new ConflictException(
      `Export برای ${report.approvedView} تا اتصال Producer، Worker و Documents فعال نیست.`,
    );
  }

  savedReports(actor: ReportingActor) {
    this.require(actor, 'reporting.read');
    if (!this.repository)
      throw new ConflictException('Persistence گزارش در دسترس نیست.');
    return this.repository.listSaved(actor.userId);
  }

  workspaceCounts(actor: ReportingActor) {
    this.require(actor, 'reporting.read');
    if (!this.repository)
      throw new ConflictException('Persistence گزارش در دسترس نیست.');
    return this.repository.workspaceCounts(actor.userId);
  }

  async dashboardProjection(
    input: Record<string, string | undefined>,
    actor: ReportingActor,
  ): Promise<DashboardProjectionV1> {
    this.require(actor, 'reporting.read');
    if (!this.repository)
      throw new ConflictException('Persistence داشبورد در دسترس نیست.');
    const now = new Date();
    const from =
      input.from ||
      (input.range && input.range !== 'custom'
        ? dashboardCalendarRangeStart(
            now,
            input.range as 'today' | 'week' | 'month' | 'quarter' | 'year',
          ).toISOString()
        : undefined);
    const filters: Record<string, string> = {};
    const boundary = (value: string, endOfDay: boolean) => {
      const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
      const parsed = new Date(
        dateOnly
          ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
          : value,
      );
      if (!Number.isFinite(parsed.getTime()))
        throw new BadRequestException('تاریخ فیلتر داشبورد معتبر نیست.');
      return parsed.toISOString();
    };
    if (from) filters.fromUtc = boundary(from, false);
    if (input.to) filters.toUtc = boundary(input.to, true);
    if (filters.fromUtc && filters.toUtc && filters.fromUtc > filters.toUtc)
      throw new BadRequestException('تاریخ شروع باید قبل از تاریخ پایان باشد.');
    const aliases: Record<string, string> = {
      salesChannel: 'salesChannel',
      branch: 'branch',
      agent: 'expert',
      service: 'serviceType',
      agency: 'agency',
      provider: 'provider',
      currency: 'currencyCode',
      status: 'status',
    };
    for (const [source, target] of Object.entries(aliases))
      if (input[source]) filters[target] = input[source]!;
    const serverBranchScope =
      actor.permissions.includes('reporting.manage') ||
      actor.permissions.includes('sales.contracts.read.all')
        ? []
        : actor.branchIds;
    const legalEntityId =
      input.legalEntity === 'NIYAYESH_SEIR_SAHAR'
        ? 'NIYAYESH'
        : input.legalEntity === 'ALL' || !input.legalEntity
          ? undefined
          : input.legalEntity;
    const scopedFilterOptions =
      typeof this.repository.dashboardFilterOptions === 'function'
        ? await this.repository.dashboardFilterOptions(
            {
              filters: Object.fromEntries(
                Object.entries(filters).filter(([key]) =>
                  ['fromUtc', 'toUtc'].includes(key),
                ),
              ),
              ...(legalEntityId ? { legalEntityId } : {}),
              page: 1,
              pageSize: 1000,
              timezone: 'Asia/Tehran',
            },
            serverBranchScope,
          )
        : null;
    const facts = await this.repository.facts(
      {
        filters,
        ...(legalEntityId ? { legalEntityId } : {}),
        page: 1,
        pageSize: 1000,
        timezone: 'Asia/Tehran',
      },
      serverBranchScope,
    );
    if (!facts.length)
      return {
        state: 'empty',
        message: 'برای فیلتر انتخاب‌شده دادهٔ تأییدشده‌ای وجود ندارد.',
        metadata: null,
        filterOptions:
          scopedFilterOptions ?? dashboardFilterOptionsFromRows(facts),
        metrics: {},
        visuals: {},
      };
    const periodStart = filters.fromUtc ? new Date(filters.fromUtc) : undefined;
    const periodEnd = filters.toUtc ? new Date(filters.toUtc) : now;
    const periodDuration = periodStart
      ? periodEnd.getTime() - periodStart.getTime()
      : 0;
    const previousFacts =
      periodStart && periodDuration > 0
        ? await this.repository.facts(
            {
              filters: {
                ...filters,
                fromUtc: new Date(
                  periodStart.getTime() - periodDuration,
                ).toISOString(),
                toUtc: periodStart.toISOString(),
              },
              ...(legalEntityId ? { legalEntityId } : {}),
              page: 1,
              pageSize: 1000,
              timezone: 'Asia/Tehran',
            },
            serverBranchScope,
          )
        : null;
    const sum = (
      rows: typeof facts,
      pick: (fact: (typeof facts)[number]) => number,
    ) => rows.reduce((total, fact) => total + pick(fact), 0);
    const comparisonFor = (currentValue: number, previousValue: number) => ({
      label: 'دوره قبل هم‌طول' as const,
      previousValue: Math.round(previousValue),
      deltaPercent:
        previousValue === 0
          ? null
          : Math.round(
              ((currentValue - previousValue) / Math.abs(previousValue)) * 1000,
            ) / 10,
      direction: (currentValue > previousValue
        ? 'up'
        : currentValue < previousValue
          ? 'down'
          : 'flat') as 'up' | 'down' | 'flat',
    });
    const trendFor = (
      rows: typeof facts,
      measure: (bucket: typeof facts) => number,
    ) => {
      if (!periodStart || periodStart.getTime() >= periodEnd.getTime())
        throw new Error('بازه زمانی معتبر برای محاسبه روند وجود ندارد.');
      const bucketStarts = dashboardTrendBucketStarts({
        from: periodStart,
        range: input.range as
          | 'today'
          | 'week'
          | 'month'
          | 'quarter'
          | 'year'
          | 'custom'
          | undefined,
        to: periodEnd,
      });
      const buckets = Array.from(
        { length: bucketStarts.length },
        () => [] as typeof facts,
      );
      for (const fact of rows) {
        if (
          fact.occurredAt.getTime() < periodStart.getTime() ||
          fact.occurredAt.getTime() >= periodEnd.getTime()
        )
          continue;
        let index = bucketStarts.length - 1;
        for (
          let candidate = bucketStarts.length - 1;
          candidate >= 0;
          candidate -= 1
        )
          if (fact.occurredAt.getTime() >= bucketStarts[candidate]!.getTime()) {
            index = candidate;
            break;
          }
        buckets[index]!.push(fact);
      }
      return {
        labels: bucketStarts.map((bucketStart) => bucketStart.toISOString()),
        values: buckets.map((bucket) => Math.round(measure(bucket))),
      };
    };
    const currencySymbol = (code: string) =>
      ({
        USD: '$',
        EUR: '€',
        GBP: '£',
        AED: 'د.إ',
        TRY: '₺',
        IRR: '﷼',
        IRI: '﷼',
      })[code] ?? code;
    const currencyTrendFor = (
      rows: typeof facts,
      measure: (bucket: typeof facts) => number,
    ) => {
      const series = currencies.map((currencyCode) => ({
        currencyCode,
        values: trendFor(
          rows.filter((fact) => fact.currencyCode === currencyCode),
          measure,
        ).values,
      }));
      const first = series[0];
      return {
        labels: trendFor(rows, measure).labels,
        values: first?.values ?? [],
        series,
      };
    };
    const leadGrowthTrend = previousFacts
      ? (() => {
          const leadCount = (rows: typeof facts) =>
            rows.filter((fact) => Boolean(fact.leadSource)).length;
          const current = trendFor(facts, leadCount);
          const previous = trendFor(previousFacts, leadCount);
          return {
            labels: current.labels,
            values: current.values.map((value, index) => {
              const previousValue = previous.values[index] ?? 0;
              return previousValue === 0
                ? 0
                : Math.round(
                    ((value - previousValue) / Math.abs(previousValue)) * 100,
                  );
            }),
          };
        })()
      : undefined;
    const metricIds = (input.kpiIds ?? '').split(',').filter(Boolean);
    const countMetrics: Record<string, (rows: typeof facts) => number> = {
      'cancelled-reservations': (rows) =>
        rows.filter((fact) => fact.reservationStatus === 'CANCELLED').length,
      'issue-success-rate': (rows) =>
        rows.length
          ? Math.round(
              (100 *
                rows.filter((fact) => fact.issueStatus === 'ISSUED').length) /
                rows.length,
            )
          : 0,
      'customer-destination-demand': (rows) =>
        new Set(
          rows
            .filter((fact) => Boolean(fact.destinationCity))
            .map((fact) => fact.orderNumber ?? fact.id),
        ).size,
      // Employee activity is not present in the travel fact grain yet. Until
      // the employee-activity projection is wired, these measures use the
      // approved travel/order grain and explicitly count distinct orders (or
      // status events) instead of summing a monetary column.
      'employee-lead-count': (rows) =>
        new Set(rows.map((fact) => fact.orderNumber ?? fact.id)).size,
      'employee-call-count': (rows) => rows.length,
      'employee-followup-count': (rows) =>
        rows.filter(
          (fact) =>
            fact.reservationStatus === 'PENDING' ||
            fact.paymentStatus === 'PENDING' ||
            fact.issueStatus === 'PENDING',
        ).length,
      'employee-finalized-sales-count': (rows) =>
        new Set(
          rows
            .filter(
              (fact) =>
                fact.orderStatus === 'CONFIRMED' &&
                fact.reservationStatus !== 'CANCELLED',
            )
            .map((fact) => fact.orderNumber ?? fact.id),
        ).size,
      'employee-lead-conversion': (rows) => {
        const eligible = new Set(
          rows.map((fact) => fact.orderNumber ?? fact.id),
        );
        const converted = new Set(
          rows
            .filter(
              (fact) =>
                fact.issueStatus === 'ISSUED' &&
                fact.reservationStatus !== 'CANCELLED',
            )
            .map((fact) => fact.orderNumber ?? fact.id),
        );
        return eligible.size
          ? Math.round((converted.size / eligible.size) * 100)
          : 0;
      },
      'employee-contract-count': (rows) =>
        new Set(rows.map((fact) => fact.orderNumber ?? fact.id)).size,
      'employee-cancellation-count': (rows) =>
        new Set(
          rows
            .filter((fact) => fact.reservationStatus === 'CANCELLED')
            .map((fact) => fact.orderNumber ?? fact.id),
        ).size,
    };
    const ratio = (numerator: number, denominator: number) =>
      denominator > 0 ? Math.round((numerator / denominator) * 100) : 0;
    const percentageMetrics: Record<string, (rows: typeof facts) => number> = {
      'ticket-cancellation-rate': (rows) =>
        ratio(
          rows.filter((fact) => fact.reservationStatus === 'CANCELLED').length,
          rows.length,
        ),
      'collection-rate': (rows) =>
        ratio(
          sum(rows, (fact) => Number(fact.settledAmount)),
          sum(rows, (fact) => Number(fact.salesAmount)),
        ),
      'refund-rate': (rows) =>
        ratio(
          sum(rows, (fact) => Number(fact.refundAmount)),
          sum(rows, (fact) => Number(fact.salesAmount)),
        ),
      'reservation-failure-rate': (rows) =>
        ratio(
          rows.filter((fact) => fact.issueStatus === 'FAILED').length,
          rows.length,
        ),
      'sell-through-rate': (rows) =>
        ratio(
          rows.filter((fact) => fact.reservationStatus === 'CONFIRMED').length,
          rows.length,
        ),
      'tour-sell-through-rate': (rows) =>
        ratio(
          rows.filter((fact) => fact.reservationStatus === 'CONFIRMED').length,
          rows.length,
        ),
      'customer-interest-coverage': (rows) =>
        ratio(rows.filter((fact) => Boolean(fact.destinationCity)).length, rows.length),
      'lead-conversion-rate': (rows) =>
        ratio(
          rows.filter(
            (fact) =>
              fact.issueStatus === 'ISSUED' &&
              fact.reservationStatus !== 'CANCELLED',
          ).length,
          rows.length,
        ),
      'sla-breach-rate': (rows) =>
        ratio(
          rows.filter((fact) => fact.issueStatus === 'FAILED').length,
          rows.length,
        ),
      'campaign-conversion': (rows) =>
        ratio(
          rows.filter(
            (fact) =>
              fact.issueStatus === 'ISSUED' &&
              fact.reservationStatus !== 'CANCELLED',
          ).length,
          rows.length,
        ),
      'consent-coverage': (rows) =>
        ratio(rows.filter((fact) => Boolean(fact.leadSource)).length, rows.length),
    };
    const amountMetrics: Record<string, (rows: typeof facts) => number> = {
      'gross-sales': (rows) => sum(rows, (fact) => Number(fact.salesAmount)),
      'net-sales': (rows) =>
        sum(
          rows,
          (fact) => Number(fact.salesAmount) - Number(fact.refundAmount),
        ),
      collected: (rows) =>
        sum(
          rows.filter((fact) => fact.paymentStatus === 'SETTLED'),
          (fact) => Number(fact.settledAmount),
        ),
      refunded: (rows) => sum(rows, (fact) => Number(fact.refundAmount)),
      'gross-profit': (rows) =>
        sum(
          rows,
          (fact) =>
            Number(fact.salesAmount) -
            Number(fact.purchaseAmount) +
            Number(fact.commissionAmount),
        ),
      'supplier-spend': (rows) =>
        sum(rows, (fact) => Number(fact.purchaseAmount)),
      'agency-sales': (rows) =>
        sum(
          rows.filter((fact) => Boolean(fact.agencyName)),
          (fact) => Number(fact.salesAmount),
        ),
      'agency-profit': (rows) =>
        sum(
          rows.filter((fact) => Boolean(fact.agencyName)),
          (fact) =>
            Number(fact.salesAmount) -
            Number(fact.purchaseAmount) +
            Number(fact.commissionAmount),
        ),
      'employee-average-sale': (rows) => {
        const orders = new Set(rows.map((fact) => fact.orderNumber ?? fact.id));
        return orders.size
          ? sum(rows, (fact) => Number(fact.salesAmount)) / orders.size
          : 0;
      },
    };
    const currencies = [
      ...new Set(facts.map((fact) => fact.currencyCode)),
    ].sort();
    const metrics = Object.fromEntries(
      metricIds.flatMap((id) => {
        const amount = amountMetrics[id];
        if (amount) {
          const comparisonSeries = previousFacts
            ? currencies.map((currencyCode) => ({
                currencyCode,
                ...comparisonFor(
                  amount(
                    facts.filter((fact) => fact.currencyCode === currencyCode),
                  ),
                  amount(
                    previousFacts.filter(
                      (fact) => fact.currencyCode === currencyCode,
                    ),
                  ),
                ),
              }))
            : [];
          const comparison =
            comparisonSeries.length === 1 ? comparisonSeries[0] : undefined;
          const trend =
            periodStart && periodDuration > 0
              ? currencyTrendFor(facts, amount)
              : undefined;
          return [
            [
              id,
              {
                value: currencies
                  .map(
                    (code) =>
                      `${currencySymbol(code)}${Math.round(amount(facts.filter((fact) => fact.currencyCode === code))).toLocaleString('fa-IR')}`,
                  )
                  .join(' · '),
                unit: 'ارزها مستقل',
                detail: `${facts.length.toLocaleString('fa-IR')} قلم سفر دمو، بدون تبدیل ارز یا تکثیر مبلغ`,
                metricId: id,
                aggregation: 'sum source-currency amount per currency',
                ...(comparison ? { comparison } : {}),
                ...(comparisonSeries.length ? { comparisonSeries } : {}),
                ...(trend ? { trend } : {}),
              },
            ],
          ];
        }
        const count = countMetrics[id];
        if (count)
          return [
            [
              id,
              {
                value: count(facts).toLocaleString('fa-IR'),
                unit:
                  id === 'issue-success-rate' || id.includes('conversion')
                    ? 'درصد'
                    : 'قلم',
                detail: 'محاسبه از grain مصوب fact سفر؛ بدون جمع‌زدن مبلغ',
                metricId: id,
                aggregation: id === 'customer-destination-demand'
                  ? 'count distinct valid orders with a destination'
                  : id.includes('conversion')
                    ? 'distinct converted orders / distinct eligible orders × 100'
                    : id.includes('cancellation')
                      ? 'count distinct cancelled orders'
                      : 'count distinct orders at approved fact grain',
                ...(previousFacts
                  ? {
                      comparison: comparisonFor(
                        count(facts),
                        count(previousFacts),
                      ),
                    }
                  : {}),
                ...(periodStart && periodDuration > 0
                  ? { trend: trendFor(facts, count) }
                  : {}),
              },
            ],
          ];
        const percentage = percentageMetrics[id];
        if (percentage || id === 'lead-growth-rate') {
          const current = percentage
            ? percentage(facts)
            : (() => {
                const currentLeads = facts.filter((fact) => Boolean(fact.leadSource)).length;
                const previousLeads = previousFacts?.filter((fact) => Boolean(fact.leadSource)).length ?? 0;
                return previousLeads > 0
                  ? Math.round(((currentLeads - previousLeads) / previousLeads) * 100)
                  : 0;
              })();
          return [
            [
              id,
              {
                value: String(current),
                unit: 'درصد',
                detail: 'نسبت مصوب شاخص به‌صورت درصدی از grain فکت سفر محاسبه شده است.',
                metricId: id,
                aggregation: id === 'lead-growth-rate'
                  ? 'change in lead count versus equal previous period × 100'
                  : 'numerator / denominator × 100',
                ...(previousFacts
                  ? {
                      comparison: comparisonFor(
                        current,
                        percentage ? percentage(previousFacts) : 0,
                      ),
                    }
                  : {}),
                ...(periodStart && periodDuration > 0 && percentage
                  ? { trend: trendFor(facts, percentage) }
                  : id === 'lead-growth-rate' && leadGrowthTrend
                    ? { trend: leadGrowthTrend }
                    : {}),
              },
            ],
          ];
        }
        return [];
      }),
    );
    const by = (
      field: keyof (typeof facts)[number],
      rows: typeof facts,
      aggregate: (groupRows: typeof facts) => number,
    ) => {
      const grouped = new Map<string, typeof facts>();
      for (const fact of rows) {
        const label = String(fact[field] ?? 'نامشخص');
        const group = grouped.get(label) ?? [];
        group.push(fact);
        grouped.set(label, group);
      }
      return [...grouped.entries()]
        .map(([label, groupRows]) => [label, aggregate(groupRows)] as const)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6);
    };
    const distinctOrders = (rows: typeof facts) =>
      new Set(rows.map((fact) => fact.orderNumber ?? fact.id)).size;
    const employeeVisuals: Record<
      string,
      {
        aggregation: string;
        aggregate: (rows: typeof facts) => number;
        monetary?: boolean;
      }
    > = {
      'employee-leads-by-agent': {
        aggregation: 'count distinct order grain',
        aggregate: distinctOrders,
      },
      'employee-calls-by-agent': {
        aggregation: 'count fact rows',
        aggregate: (rows) => rows.length,
      },
      'employee-followups-by-agent': {
        aggregation: 'count pending workflow actions',
        aggregate: (rows) =>
          rows.filter(
            (fact) =>
              fact.reservationStatus === 'PENDING' ||
              fact.paymentStatus === 'PENDING' ||
              fact.issueStatus === 'PENDING',
          ).length,
      },
      'employee-sales-count-by-agent': {
        aggregation: 'count distinct confirmed non-cancelled orders',
        aggregate: (rows) =>
          new Set(
            rows
              .filter(
                (fact) =>
                  fact.orderStatus === 'CONFIRMED' &&
                  fact.reservationStatus !== 'CANCELLED',
              )
              .map((fact) => fact.orderNumber ?? fact.id),
          ).size,
      },
      'employee-sales-amount-by-agent': {
        aggregation: 'sum salesAmount at order-item-currency grain',
        aggregate: (rows) => sum(rows, (fact) => Number(fact.salesAmount)),
        monetary: true,
      },
      'employee-conversion-by-agent': {
        aggregation: 'distinct issued orders / distinct eligible orders × 100',
        aggregate: (rows) => {
          const eligible = distinctOrders(rows);
          const converted = new Set(
            rows
              .filter(
                (fact) =>
                  fact.issueStatus === 'ISSUED' &&
                  fact.reservationStatus !== 'CANCELLED',
              )
              .map((fact) => fact.orderNumber ?? fact.id),
          ).size;
          return eligible ? Math.round((converted / eligible) * 100) : 0;
        },
      },
      'employee-average-sale-by-agent': {
        aggregation: 'sum salesAmount / count distinct orders',
        aggregate: (rows) => {
          const orders = distinctOrders(rows);
          return orders
            ? sum(rows, (fact) => Number(fact.salesAmount)) / orders
            : 0;
        },
        monetary: true,
      },
      'employee-contracts-by-agent': {
        aggregation: 'count distinct orders by contract status',
        aggregate: distinctOrders,
      },
      'employee-cancellations-by-agent': {
        aggregation: 'count distinct cancelled orders',
        aggregate: (rows) =>
          new Set(
            rows
              .filter((fact) => fact.reservationStatus === 'CANCELLED')
              .map((fact) => fact.orderNumber ?? fact.id),
          ).size,
      },
      'employee-performance-ranking': {
        aggregation: 'rank by sum salesAmount in selected currency',
        aggregate: (rows) => sum(rows, (fact) => Number(fact.salesAmount)),
        monetary: true,
      },
    };
    const visualIds = (input.visualIds ?? '').split(',').filter(Boolean);
    const visualFields: Record<string, keyof (typeof facts)[number]> = {
      'executive-sales-by-service': 'serviceType',
      'sales-channel': 'salesChannel',
      'service-type': 'serviceType',
      'service-sales-portfolio': 'serviceType',
      'sales-destination-ranking': 'destinationCity',
      'sales-by-route': 'routeLabel',
      'route-sales-performance': 'routeLabel',
      'airline-sales-performance': 'airlineName',
      'agency-sales': 'agencyName',
      'supplier-spend': 'providerName',
      'employee-leads-by-agent': 'ownerName',
      'employee-calls-by-agent': 'ownerName',
      'employee-followups-by-agent': 'ownerName',
      'employee-sales-count-by-agent': 'ownerName',
      'employee-sales-amount-by-agent': 'ownerName',
      'employee-conversion-by-agent': 'ownerName',
      'employee-average-sale-by-agent': 'ownerName',
      'employee-contracts-by-agent': 'ownerName',
      'employee-cancellations-by-agent': 'ownerName',
      'employee-performance-ranking': 'ownerName',
    };
    const percentageVisuals: Record<
      string,
      {
        field: keyof (typeof facts)[number];
        numerator: (rows: typeof facts) => number;
        denominator?: (rows: typeof facts) => number;
        aggregation: string;
      }
    > = {
      'provider-failure-rate': {
        field: 'providerName',
        numerator: (rows) =>
          rows.filter((fact) => fact.issueStatus === 'FAILED').length,
        aggregation: 'failed operations / provider operations × 100',
      },
      'ticket-cancellation-analysis': {
        field: 'airlineName',
        numerator: (rows) =>
          rows.filter((fact) => fact.reservationStatus === 'CANCELLED').length,
        aggregation: 'cancelled tickets / eligible tickets × 100',
      },
      'lead-source-conversion': {
        field: 'leadSource',
        numerator: (rows) =>
          rows.filter(
            (fact) =>
              fact.issueStatus === 'ISSUED' &&
              fact.reservationStatus !== 'CANCELLED',
          ).length,
        aggregation: 'converted leads / eligible leads × 100',
      },
      'popular-hotel-cities': {
        field: 'destinationCity',
        numerator: (rows) => rows.length,
        denominator: () => visualFacts.length,
        aggregation: 'hotel reservations in city / all hotel reservations × 100',
      },
      'customer-acquisition-channel-mix': {
        field: 'leadSource',
        numerator: (rows) => rows.length,
        denominator: () => visualFacts.length,
        aggregation: 'customers in channel / all customers × 100',
      },
    };
    const trendVisualIds = new Set([
      'finalized-sales-trend',
      'executive-lead-acquisition',
    ]);
    const acquisitionChannelTrendVisualIds = new Set([
      'customer-acquisition-channel-trend',
    ]);
    const funnelVisualIds = new Set([
      'commercial-pipeline',
      'crm-funnel',
      'executive-lead-conversion',
    ]);
    const queueVisualIds = new Set([
      'crm-followup-queue',
      'executive-exceptions',
    ]);
    // Every monetary chart has one default currency plus separate source-currency
    // series for its local selector; numeric marks never combine IRR and USD.
    const visualCurrency =
      input.currency ?? (currencies.includes('IRR') ? 'IRR' : currencies[0]!);
    const visualFacts = facts.filter(
      (fact) => fact.currencyCode === visualCurrency,
    );
    const visualAmount = (rows: typeof facts) =>
      sum(rows, (fact) => Number(fact.salesAmount));
    const monetaryVisualFor = (id: string, currencyCode: string) => {
      const currencyFacts = facts.filter(
        (fact) => fact.currencyCode === currencyCode,
      );
      const previousCurrencyFacts = (previousFacts ?? []).filter(
        (fact) => fact.currencyCode === currencyCode,
      );
      if (trendVisualIds.has(id)) {
        const trend = trendFor(currencyFacts, visualAmount);
        return {
          labels: trend.labels,
          values: trend.values,
          currencyCode,
          metricId: id,
          aggregation: 'sum salesAmount per time bucket',
        };
      }
      const employeeVisual = employeeVisuals[id];
      if (employeeVisual) {
        if (!employeeVisual.monetary) return undefined;
        const entries = by(
          'ownerName',
          currencyFacts,
          employeeVisual.aggregate,
        );
        return {
          labels: entries.map(([label]) => label),
          values: entries.map(([, value]) => Math.round(value)),
          currencyCode,
          metricId: id,
          aggregation: employeeVisual.aggregation,
          ...(previousFacts
            ? {
                comparison: comparisonFor(
                  employeeVisual.aggregate(currencyFacts),
                  employeeVisual.aggregate(previousCurrencyFacts),
                ),
              }
            : {}),
        };
      }
      const field = visualFields[id];
      if (!field) return undefined;
      const entries = by(field, currencyFacts, visualAmount);
      return {
        labels: entries.map(([label]) => label),
        values: entries.map(([, value]) => Math.round(value)),
        currencyCode,
        metricId: id,
        aggregation: 'sum salesAmount by selected dimension',
        ...(previousFacts
          ? {
              comparison: comparisonFor(
                visualAmount(currencyFacts),
                visualAmount(previousCurrencyFacts),
              ),
              trend: trendFor(currencyFacts, visualAmount),
            }
          : {}),
      };
    };
    const visuals = Object.fromEntries(
      visualIds.flatMap<[string, DashboardProjectionV1['visuals'][string]]>(
        (id) => {
          if (acquisitionChannelTrendVisualIds.has(id)) {
            const customerIdentity = (fact: (typeof facts)[number]) =>
              fact.customerName?.trim() || fact.orderNumber || fact.id;
            const knownChannelFacts = facts.filter((fact) =>
              Boolean(fact.leadSource?.trim()),
            );
            const distinctCustomers = (rows: typeof facts) =>
              new Set(rows.map(customerIdentity)).size;
            const trend = trendFor(knownChannelFacts, distinctCustomers);
            const channels = [
              ...new Set(
                knownChannelFacts.map((fact) => fact.leadSource!.trim()),
              ),
            ].sort((left, right) => left.localeCompare(right, 'fa'));
            return [
              [
                id,
                {
                  labels: trend.labels,
                  values: trend.values,
                  series: channels.map((channel) => ({
                    label: channel,
                    values: trendFor(
                      knownChannelFacts.filter(
                        (fact) => fact.leadSource?.trim() === channel,
                      ),
                      distinctCustomers,
                    ).values,
                  })),
                  unit: 'مشتری',
                  metricId: id,
                  aggregation:
                    'count distinct customers with a known acquisition channel per time bucket',
                },
              ],
            ];
          }
          if (employeeVisuals[id] && !employeeVisuals[id].monetary) {
            const entries = by(
              'ownerName',
              facts,
              employeeVisuals[id].aggregate,
            );
            return [
              [
                id,
                {
                  labels: entries.map(([label]) => label),
                  values: entries.map(([, value]) => Math.round(value)),
                  ...(id === 'employee-conversion-by-agent'
                    ? { unit: 'درصد' }
                    : {}),
                  metricId: id,
                  aggregation: employeeVisuals[id].aggregation,
                  ...(previousFacts
                    ? {
                        comparison: comparisonFor(
                          employeeVisuals[id].aggregate(facts),
                          employeeVisuals[id].aggregate(previousFacts),
                        ),
                      }
                    : {}),
                },
              ],
            ];
          }
          const percentageVisual = percentageVisuals[id];
          if (percentageVisual) {
            const entries = by(
              percentageVisual.field,
              visualFacts,
              (rows) =>
                ratio(
                  percentageVisual.numerator(rows),
                  percentageVisual.denominator?.(rows) ?? rows.length,
                ),
            );
            return [
              [
                id,
                {
                  labels: entries.map(([label]) => label),
                  values: entries.map(([, value]) => value),
                  unit: 'درصد',
                  metricId: id,
                  aggregation: percentageVisual.aggregation,
                },
              ],
            ];
          }
          if (trendVisualIds.has(id) || visualFields[id]) {
            const selectedCurrencyVisual = monetaryVisualFor(
              id,
              visualCurrency,
            );
            if (!selectedCurrencyVisual) return [];
            const currencySeries = currencies.flatMap((currencyCode) => {
              const series = monetaryVisualFor(id, currencyCode);
              return series ? [series] : [];
            });
            return [
              [
                id,
                {
                  ...selectedCurrencyVisual,
                  currencySeries,
                },
              ],
            ];
          }
          if (funnelVisualIds.has(id)) {
            const stages = [
              ['رزرو ثبت‌شده', visualFacts.length],
              [
                'رزرو تأییدشده',
                visualFacts.filter(
                  (fact) => fact.reservationStatus === 'CONFIRMED',
                ).length,
              ],
              [
                'پرداخت‌شده',
                visualFacts.filter((fact) => fact.paymentStatus === 'SETTLED')
                  .length,
              ],
              [
                'صدور نهایی',
                visualFacts.filter(
                  (fact) =>
                    fact.paymentStatus === 'SETTLED' &&
                    fact.issueStatus === 'ISSUED',
                ).length,
              ],
            ] as const;
            return [
              [
                id,
                {
                  labels: stages.map(([label]) => label),
                  values: stages.map(([, value]) => value),
                  metricId: id,
                  aggregation: 'count rows by reservation/payment/issue stage',
                },
              ],
            ];
          }
          if (queueVisualIds.has(id)) {
            const queue = [
              [
                'رزرو در انتظار',
                visualFacts.filter(
                  (fact) => fact.reservationStatus === 'PENDING',
                ).length,
              ],
              [
                'پرداخت در انتظار',
                visualFacts.filter((fact) => fact.paymentStatus === 'PENDING')
                  .length,
              ],
              [
                'صدور در انتظار',
                visualFacts.filter((fact) => fact.issueStatus === 'PENDING')
                  .length,
              ],
              [
                'رزرو لغوشده',
                visualFacts.filter(
                  (fact) => fact.reservationStatus === 'CANCELLED',
                ).length,
              ],
            ] as const;
            return [
              [
                id,
                {
                  labels: queue.map(([label]) => label),
                  values: queue.map(([, value]) => value),
                  metricId: id,
                  aggregation: 'count rows by pending workflow state',
                },
              ],
            ];
          }
          return [];
        },
      ),
    );
    const dataAsOf = facts
      .reduce(
        (latest, fact) => (latest > fact.dataAsOf ? latest : fact.dataAsOf),
        facts[0]!.dataAsOf,
      )
      .toISOString();
    return {
      state: 'ready',
      message: 'فقط شاخص‌های دارای منبع fact سفر در دمو محاسبه شده‌اند.',
      filterOptions:
        scopedFilterOptions ?? dashboardFilterOptionsFromRows(facts),
      metrics,
      visuals,
      metadata: {
        generatedAt: now.toISOString(),
        dataAsOf,
        timezone: 'Asia/Tehran',
        dateBasis: input.dateBasis ?? 'effective',
        currencyFxBasis: `KPI به تفکیک ارز؛ نمودار ${visualCurrency} بدون FX`,
        reportVersion: 'reporting.dashboard.travel.v1',
        permissionSnapshot: 'server-enforced',
      },
    };
  }

  saveReport(
    input: {
      reportCode: string;
      name: string;
      sharingScope: string;
      isFavorite?: boolean;
      filterState: unknown;
      recordAction?: boolean;
    },
    actor: ReportingActor,
  ) {
    const report = this.metadata(input.reportCode, actor);
    if (!this.repository)
      throw new ConflictException('Persistence گزارش در دسترس نیست.');
    return this.repository.createSaved(actor.userId, {
      ...input,
      ...(input.recordAction
        ? {
            runMetadata: {
              viewName: report.approvedView,
              viewVersion: report.version,
            },
          }
        : {}),
    });
  }

  async sharingRecipients(reportCode: string, actor: ReportingActor) {
    this.requireShare(actor);
    const report = this.metadata(reportCode, actor);
    if (!this.repository)
      throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const candidates = await this.repository.sharingCandidates(
      actor.userId,
      actor.permissions.includes('reporting.manage') ? [] : actor.branchIds,
    );
    return candidates
      .filter((candidate) => {
        const recipient: ReportingActor = {
          userId: candidate.id,
          permissions: candidate.permissions,
          branchIds: [],
        };
        return (
          candidate.permissions.includes('reporting.read') &&
          this.canReadReport(recipient, report.permission)
        );
      })
      .map((candidate) => ({
        id: candidate.id,
        displayName: candidate.displayName,
        username: candidate.username,
      }));
  }

  async savedReportShares(id: string, actor: ReportingActor) {
    this.requireShare(actor);
    if (!this.repository)
      throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const savedReport = await this.repository.savedReportById(id);
    if (!savedReport || savedReport.ownerUserId !== actor.userId)
      throw new NotFoundException('گزارش ذخیره‌شده پیدا نشد.');
    return {
      savedReportId: id,
      recipientUserIds: await this.repository.sharedRecipientIds(id),
    };
  }

  async shareSavedReport(
    id: string,
    recipientUserIds: readonly string[],
    actor: ReportingActor,
  ) {
    this.requireShare(actor);
    if (!this.repository)
      throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const savedReport = await this.repository.savedReportById(id);
    if (!savedReport || savedReport.ownerUserId !== actor.userId)
      throw new NotFoundException('گزارش ذخیره‌شده پیدا نشد.');
    const reportCode = String(savedReport.reportCode);
    const eligible = await this.sharingRecipients(reportCode, actor);
    const allowedIds = new Set(eligible.map((candidate) => candidate.id));
    const uniqueRecipientIds = [...new Set(recipientUserIds)];
    if (uniqueRecipientIds.includes(actor.userId))
      throw new ForbiddenException('اشتراک‌گذاری گزارش با خودتان مجاز نیست.');
    if (uniqueRecipientIds.some((recipientId) => !allowedIds.has(recipientId)))
      throw new ForbiddenException(
        'یک یا چند گیرنده، مجوز مشاهده این گزارش را ندارند.',
      );
    return this.repository.replaceSavedReportShares(
      id,
      actor.userId,
      uniqueRecipientIds,
    );
  }

  async deleteSavedReport(id: string, actor: ReportingActor) {
    if (!this.repository)
      throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const count = await this.repository.deleteSaved(id, actor.userId);
    if (!count) throw new NotFoundException('گزارش ذخیره‌شده پیدا نشد.');
    return { deleted: true };
  }

  async runs(actor: ReportingActor) {
    this.require(actor, 'reporting.read');
    if (!this.repository)
      throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const rows = await this.repository.listRuns(actor.userId);
    return rows.map((row) => ({
      ...row,
      reportName:
        REPORTING_CATALOG_V1.find((report) => report.code === row.reportCode)
          ?.title ?? String(row.reportCode),
    }));
  }

  exports(actor: ReportingActor) {
    this.require(actor, 'reporting.export');
    if (!this.repository)
      throw new ConflictException('Persistence گزارش در دسترس نیست.');
    return this.repository.listExports(actor.userId);
  }

  private async travelResult(
    code: string,
    queryInput: ReportQueryV1,
    actor: ReportingActor,
  ) {
    const report = this.metadata(code, actor);
    if (report.producerStatus !== 'READY')
      throw new ConflictException(
        'خروجی این گزارش هنوز به Public Projection متصل نیست.',
      );
    const serverBranchScope =
      actor.permissions.includes('sales.contracts.read.all') ||
      actor.permissions.includes('reporting.read')
        ? []
        : actor.branchIds;
    const query = validateReportQuery(
      { ...queryInput, branchIds: serverBranchScope },
      MAX_PREVIEW_PAGE_SIZE,
    );
    if (!this.repository)
      throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const facts = await this.repository.facts(query, serverBranchScope);
    return {
      report,
      result: buildTravelReportResult({
        code,
        query,
        facts,
        now: new Date(),
        includeAllRows: true,
      }),
    };
  }

  async createExport(
    code: string,
    input: {
      format: 'CSV' | 'XLSX' | 'PDF';
      query: ReportQueryV1;
      simulateFailure?: boolean;
    },
    actor: ReportingActor,
  ) {
    this.require(actor, 'reporting.export');
    const started = Date.now();
    if (!this.repository || !this.exportFiles)
      throw new ConflictException('سرویس خروجی گزارش در دسترس نیست.');
    const reportMetadata = this.metadata(code, actor);
    const serverBranchScope =
      actor.permissions.includes('sales.contracts.read.all') ||
      actor.permissions.includes('reporting.read')
        ? []
        : actor.branchIds;
    const query = validateReportQuery(
      { ...input.query, branchIds: serverBranchScope },
      MAX_PREVIEW_PAGE_SIZE,
    );
    const run = await this.repository.createRun({
      reportCode: code,
      actorUserId: actor.userId,
      filterSnapshot: { ...query, actionType: 'EXPORT' },
      viewName: reportMetadata.approvedView,
      viewVersion: reportMetadata.version,
    });
    let report: typeof reportMetadata;
    let result: TravelReportResultV1;
    try {
      ({ report, result } = await this.travelResult(code, input.query, actor));
    } catch (error) {
      await this.repository.failRun(
        String(run.id),
        'دریافت داده برای خروجی ناموفق بود.',
        Date.now() - started,
      );
      throw error;
    }
    const date = new Date().toISOString().slice(0, 10);
    const safeCode = code.replace(/[^a-z0-9_-]/g, '_');
    const extension = input.format.toLowerCase();
    let artifact: Awaited<ReturnType<ReportingRepository['createExport']>>;
    try {
      artifact = await this.repository.createExport({
        runId: String(run.id),
        creatorUserId: actor.userId,
        reportCode: code,
        reportName: report.title,
        format: input.format,
        fileName: `${safeCode}_${date}.${extension}`,
        contentType:
          input.format === 'CSV'
            ? 'text/csv; charset=utf-8'
            : input.format === 'XLSX'
              ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
              : 'application/pdf',
        filterSnapshot: result.filterSnapshot,
      });
    } catch (error) {
      await this.repository.failRun(
        String(run.id),
        'شروع تولید خروجی ناموفق بود.',
        Date.now() - started,
      );
      throw error;
    }
    if (input.simulateFailure) {
      const failureMessage = 'سناریوی کنترل‌شده خطای تولید خروجی برای دمو.';
      await this.repository.failExport(String(artifact.id), failureMessage);
      await this.repository.failRun(
        String(run.id),
        failureMessage,
        Date.now() - started,
      );
      return {
        ...artifact,
        status: 'FAILED',
        errorMessage: failureMessage,
      };
    }
    try {
      const file = this.exportFiles.build(input.format, result, report.title);
      const objectKey = await this.exportFiles.store(
        String(artifact.id),
        file.extension,
        file.buffer,
      );
      await this.repository.finishExport(
        String(artifact.id),
        objectKey,
        file.buffer.length,
        file.checksum,
      );
      await this.repository.finishRun(
        String(run.id),
        result.total,
        Date.now() - started,
      );
      return {
        ...artifact,
        status: 'READY',
        objectKey,
        sizeBytes: file.buffer.length,
        checksumSha256: file.checksum,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'تولید خروجی ناموفق بود.';
      await this.repository.failExport(String(artifact.id), message);
      await this.repository.failRun(
        String(run.id),
        'تولید خروجی ناموفق بود.',
        Date.now() - started,
      );
      throw new ConflictException(message);
    }
  }

  async downloadExport(id: string, actor: ReportingActor) {
    this.require(actor, 'reporting.export');
    if (!this.repository || !this.exportFiles)
      throw new ConflictException('سرویس خروجی گزارش در دسترس نیست.');
    const artifact = await this.repository.exportById(id, actor.userId);
    if (!artifact) throw new NotFoundException('خروجی پیدا نشد.');
    if (
      artifact.status !== 'READY' ||
      !artifact.objectKey ||
      !artifact.sizeBytes
    )
      throw new ConflictException('فایل خروجی هنوز آماده دانلود نیست.');
    if (
      artifact.expiresAt &&
      new Date(String(artifact.expiresAt)) <= new Date()
    )
      throw new ConflictException('مهلت دانلود این خروجی پایان یافته است.');
    return {
      buffer: await this.exportFiles.read(
        String(artifact.objectKey),
        Number(artifact.sizeBytes),
      ),
      fileName: String(artifact.fileName),
      contentType: String(artifact.contentType),
    };
  }

  async retryExport(id: string, actor: ReportingActor) {
    this.require(actor, 'reporting.export');
    if (!this.repository)
      throw new ConflictException('Persistence گزارش در دسترس نیست.');
    const artifact = await this.repository.exportById(id, actor.userId);
    if (!artifact) throw new NotFoundException('خروجی پیدا نشد.');
    if (artifact.status !== 'FAILED' && artifact.status !== 'EXPIRED')
      throw new ConflictException(
        'فقط خروجی ناموفق یا منقضی قابل تلاش مجدد است.',
      );
    const snapshot = artifact.filterSnapshot as unknown as {
      filters?: Record<string, string | string[]>;
      legalEntityId?: string;
      branchIds?: string[];
      sort?: ReportQueryV1['sort'];
      timezone?: 'Asia/Tehran';
    };
    return this.createExport(
      String(artifact.reportCode),
      {
        format: artifact.format as 'CSV' | 'XLSX' | 'PDF',
        query: {
          filters: snapshot.filters ?? {},
          page: 1,
          pageSize: 100,
          ...(snapshot.sort ? { sort: snapshot.sort } : {}),
          ...(snapshot.legalEntityId
            ? { legalEntityId: snapshot.legalEntityId }
            : {}),
          ...(snapshot.branchIds?.length
            ? { branchIds: snapshot.branchIds }
            : {}),
          timezone: snapshot.timezone ?? 'Asia/Tehran',
        },
      },
      actor,
    );
  }
}
