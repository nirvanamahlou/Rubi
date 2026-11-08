import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@nora/database';

import type {
  ReportQueryV1,
  TravelReportResultV1,
  TravelReportRowV1,
} from './reporting.contracts';
import type { ReportingFactRow } from './reporting.repository';
import { currencyValues } from './reporting-currency-values';
import {
  createFilterSnapshot,
  MAX_PREVIEW_PAGE_SIZE,
} from './reporting.policy';

type DimensionKey = keyof Pick<
  ReportingFactRow,
  | 'salesChannel'
  | 'serviceType'
  | 'providerName'
  | 'agencyName'
  | 'customerType'
  | 'reservationStatus'
  | 'issueStatus'
  | 'paymentStatus'
  | 'leadSource'
  | 'routeLabel'
  | 'destinationCity'
  | 'airlineName'
  | 'legalEntityName'
  | 'branchName'
  | 'ownerName'
  | 'orderStatus'
>;

const REPORT_DIMENSIONS: Readonly<
  Record<string, readonly [DimensionKey, DimensionKey]>
> = {
  sales_by_organization: ['legalEntityName', 'ownerName'],
  sales_by_service_route: ['serviceType', 'routeLabel'],
  purchase_by_supplier: ['providerName', 'serviceType'],
  contract_service_profit: ['serviceType', 'providerName'],
  payments_refunds: ['paymentStatus', 'salesChannel'],
  paid_not_issued: ['issueStatus', 'providerName'],
  reservation_errors: ['reservationStatus', 'providerName'],
  cancellations_refunds: ['reservationStatus', 'serviceType'],
  tickets_manifest: ['routeLabel', 'airlineName'],
  agency_performance: ['agencyName', 'salesChannel'],
  lead_to_order_conversion: ['leadSource', 'customerType'],
  route_passengers: ['destinationCity', 'routeLabel'],
  sales_contract_pipeline: ['orderStatus', 'reservationStatus'],
};

const DIMENSION_LABELS: Readonly<Record<DimensionKey, string>> = {
  salesChannel: 'کانال فروش',
  serviceType: 'نوع خدمت',
  providerName: 'تأمین‌کننده',
  agencyName: 'آژانس',
  customerType: 'نوع مشتری',
  reservationStatus: 'وضعیت رزرو',
  issueStatus: 'وضعیت صدور',
  paymentStatus: 'وضعیت پرداخت',
  leadSource: 'منبع لید',
  routeLabel: 'مسیر سفر',
  destinationCity: 'شهر مقصد',
  airlineName: 'شرکت هواپیمایی',
  legalEntityName: 'شرکت',
  branchName: 'شعبه',
  ownerName: 'کارشناس',
  orderStatus: 'وضعیت قرارداد',
};

const pendingReservationStatuses = new Set([
  'QUEUED',
  'NEEDS_REVIEW',
  'PARTIALLY_FULFILLED',
]);

function exposesPendingReservationActions(reportCode: string) {
  return reportCode === 'paid_not_issued';
}

function amount(value: Prisma.Decimal | string) {
  return new Prisma.Decimal(value);
}
function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : 'نامشخص';
}

/** Eligibility is applied before totals, pagination and export, not just labels. */
export function eligibleTravelReportFacts(
  code: string,
  facts: readonly ReportingFactRow[],
): readonly ReportingFactRow[] {
  return facts.filter((fact) => {
    if (
      [
        'sales_by_organization',
        'sales_by_service_route',
        'route_passengers',
        'contract_service_profit',
        'agency_performance',
        'lead_to_order_conversion',
      ].includes(code) &&
      fact.orderStatus === 'CANCELLED'
    )
      return false;
    switch (code) {
      case 'paid_not_issued':
        return (
          fact.paymentStatus === 'PAID' &&
          [
            'PENDING',
            'NOT_ISSUED',
            'PARTIALLY_ISSUED',
            'ERROR',
            'FAILED',
          ].includes(fact.issueStatus) &&
          fact.orderStatus !== 'CANCELLED' &&
          fact.reservationStatus !== 'CANCELLED'
        );
      case 'reservation_errors':
        return ['ERROR', 'FAILED'].includes(fact.reservationStatus);
      case 'cancellations_refunds':
        return (
          fact.reservationStatus === 'CANCELLED' ||
          fact.orderStatus === 'CANCELLED' ||
          fact.refundAmount.greaterThan(0)
        );
      case 'tickets_manifest':
        return fact.ticketCount > 0;
      case 'purchase_by_supplier':
        return (
          Boolean(fact.providerName?.trim()) &&
          fact.purchaseAmount.greaterThan(0)
        );
      case 'agency_performance':
        return Boolean(fact.agencyName?.trim());
      case 'lead_to_order_conversion':
        return Boolean(fact.leadSource?.trim());
      default:
        return true;
    }
  });
}

export function buildTravelReportResult(input: {
  code: string;
  query: ReportQueryV1;
  facts: readonly ReportingFactRow[];
  now: Date;
  includeAllRows?: boolean;
  dimensionOverride?: readonly [DimensionKey, DimensionKey];
  dimensionIdentity?: (fact: ReportingFactRow) => readonly [string, string];
}): TravelReportResultV1 {
  const dimensions = input.dimensionOverride ?? REPORT_DIMENSIONS[input.code];
  if (!dimensions)
    throw new BadRequestException('این گزارش به Projection سفر متصل نشده است.');
  const facts = eligibleTravelReportFacts(input.code, input.facts);
  const groups = new Map<
    string,
    TravelReportRowV1 & {
      orderIds: Set<string>;
      countItems: Map<string, { passengers: number; tickets: number }>;
      money: Map<string, Record<string, string>>;
      pendingReservationOrderIds: Set<string>;
    }
  >();
  for (const fact of facts) {
    const primaryDimension = text(fact[dimensions[0]]);
    const secondaryDimension = text(fact[dimensions[1]]);
    const identity = input.dimensionIdentity?.(fact) ?? [
      primaryDimension,
      secondaryDimension,
    ];
    const key = JSON.stringify(identity);
    const current = groups.get(key) ?? {
      grainId: key,
      primaryDimension,
      secondaryDimension,
      currencyCode: fact.currencyCode,
      orderCount: 0,
      passengerCount: 0,
      ticketCount: 0,
      salesAmount: '0',
      purchaseAmount: '0',
      grossProfit: '0',
      refundAmount: '0',
      settlementBalance: '0',
      pendingReservationActions: 0,
      orderIds: new Set<string>(),
      countItems: new Map(),
      money: new Map(),
      pendingReservationOrderIds: new Set<string>(),
    };
    current.orderIds.add(fact.orderNumber);
    if (pendingReservationStatuses.has(fact.reservationStatus))
      current.pendingReservationOrderIds.add(fact.orderNumber);
    current.orderCount = current.orderIds.size;
    current.pendingReservationActions = current.pendingReservationOrderIds.size;
    const countId = fact.sourceItemId ?? fact.id;
    const previousCounts = current.countItems.get(countId);
    current.countItems.set(countId, {
      passengers: fact.passengerCount,
      tickets: fact.ticketCount,
    });
    current.passengerCount +=
      fact.passengerCount - (previousCounts?.passengers ?? 0);
    current.ticketCount += fact.ticketCount - (previousCounts?.tickets ?? 0);
    const money = current.money.get(fact.currencyCode) ?? {
      salesAmount: '0',
      purchaseAmount: '0',
      grossProfit: '0',
      refundAmount: '0',
      settlementBalance: '0',
    };
    const additions = {
      salesAmount: fact.salesAmount,
      purchaseAmount: fact.purchaseAmount,
      grossProfit: fact.salesAmount
        .minus(fact.purchaseAmount)
        .plus(fact.commissionAmount),
      refundAmount: fact.refundAmount,
      settlementBalance: fact.salesAmount
        .minus(fact.refundAmount)
        .minus(fact.settledAmount),
    };
    for (const [name, value] of Object.entries(additions))
      money[name] = amount(money[name]!).plus(value).toString();
    current.money.set(fact.currencyCode, money);
    // Scalar compatibility fields retain the first currency, never a mixed sum.
    const firstCurrency = current.money.get(current.currencyCode)!;
    current.salesAmount = firstCurrency.salesAmount!;
    current.purchaseAmount = firstCurrency.purchaseAmount!;
    current.grossProfit = firstCurrency.grossProfit!;
    current.refundAmount = firstCurrency.refundAmount!;
    current.settlementBalance = firstCurrency.settlementBalance!;
    groups.set(key, current);
  }
  const sortable = new Set<keyof TravelReportRowV1>([
    'primaryDimension',
    'secondaryDimension',
    'currencyCode',
    'orderCount',
    'passengerCount',
    'ticketCount',
    'salesAmount',
    'purchaseAmount',
    'grossProfit',
    'refundAmount',
    'settlementBalance',
  ]);
  if (exposesPendingReservationActions(input.code))
    sortable.add('pendingReservationActions');
  const sort = input.query.sort ?? {
    column: 'salesAmount',
    direction: 'DESC' as const,
  };
  if (!sortable.has(sort.column as keyof TravelReportRowV1))
    throw new BadRequestException('ستون مرتب‌سازی گزارش مجاز نیست.');
  const rows = [...groups.values()].map((group) => ({
    grainId: group.grainId,
    primaryDimension: group.primaryDimension,
    secondaryDimension: group.secondaryDimension,
    currencyCode: group.currencyCode,
    orderCount: group.orderCount,
    passengerCount: group.passengerCount,
    ticketCount: group.ticketCount,
    salesAmount: group.salesAmount,
    purchaseAmount: group.purchaseAmount,
    grossProfit: group.grossProfit,
    refundAmount: group.refundAmount,
    settlementBalance: group.settlementBalance,
    pendingReservationActions: group.pendingReservationActions,
    amountsByCurrency: [...group.money].map(([currencyCode, money]) => ({
      currencyCode,
      amount: money.salesAmount!,
    })),
    sourceValues: {
      primaryDimension: group.primaryDimension,
      secondaryDimension: group.secondaryDimension,
      orderCount: group.orderCount,
      passengerCount: group.passengerCount,
      ticketCount: group.ticketCount,
      pendingReservationActions: group.pendingReservationActions,
      ...Object.fromEntries(
        [
          'salesAmount',
          'purchaseAmount',
          'grossProfit',
          'refundAmount',
          'settlementBalance',
        ].map((name) => [
          name,
          currencyValues(
            new Map(
              [...group.money].map(([currency, money]) => [
                currency,
                money[name]!,
              ]),
            ),
          ),
        ]),
      ),
    },
  }));
  const mixedCurrencies =
    new Set(facts.map((fact) => fact.currencyCode)).size > 1;
  rows.sort((left, right) => {
    const l = left[sort.column as keyof TravelReportRowV1];
    const r = right[sort.column as keyof TravelReportRowV1];
    const compared = [
      'salesAmount',
      'purchaseAmount',
      'grossProfit',
      'refundAmount',
      'settlementBalance',
    ].includes(sort.column)
      ? !mixedCurrencies
        ? amount(String(l)).comparedTo(amount(String(r)))
        : left.orderCount - right.orderCount
      : typeof l === 'number' && typeof r === 'number'
        ? l - r
        : String(l).localeCompare(String(r), 'fa');
    return compared * (sort.direction === 'ASC' ? 1 : -1);
  });
  // Pipeline rows retain cancelled/draft contracts as separate status groups,
  // but its sales headline must only sum confirmed active contracts.
  const totalFacts =
    input.code === 'sales_contract_pipeline'
      ? facts.filter((fact) =>
          [
            'CONFIRMED',
            'SENT_TO_RESERVATIONS',
            'IN_PROGRESS',
            'COMPLETED',
          ].includes(fact.orderStatus),
        )
      : facts;
  const currencies = [...new Set(totalFacts.map((fact) => fact.currencyCode))];
  const totalsByCurrency = currencies.map((currencyCode) => {
    const scoped = totalFacts.filter(
      (fact) => fact.currencyCode === currencyCode,
    );
    const sum = (select: (fact: ReportingFactRow) => Prisma.Decimal) =>
      scoped
        .reduce(
          (total, fact) => total.plus(select(fact)),
          new Prisma.Decimal(0),
        )
        .toString();
    return {
      currencyCode,
      salesAmount: sum((fact) => fact.salesAmount),
      purchaseAmount: sum((fact) => fact.purchaseAmount),
      grossProfit: sum((fact) =>
        fact.salesAmount.minus(fact.purchaseAmount).plus(fact.commissionAmount),
      ),
      refundAmount: sum((fact) => fact.refundAmount),
      settlementBalance: sum((fact) =>
        fact.salesAmount.minus(fact.refundAmount).minus(fact.settledAmount),
      ),
    };
  });
  const generatedAtUtc = input.now.toISOString();
  const offset = (input.query.page - 1) * input.query.pageSize;
  const option = (key: keyof ReportingFactRow) =>
    [...new Set(facts.map((fact) => text(fact[key])))].sort((a, b) =>
      a.localeCompare(b, 'fa'),
    );
  return {
    reportCode: input.code,
    reportVersion: 1,
    grain: 'ORDER_ITEM_CURRENCY',
    sourceProjection: 'reporting.travel.facts.v1',
    dataLayout: 'SOURCE_COLUMNS',
    chartMeasure: 'salesAmount',
    columns: [
      {
        key: 'primaryDimension',
        label: DIMENSION_LABELS[dimensions[0]],
        kind: 'TEXT',
      },
      {
        key: 'secondaryDimension',
        label: DIMENSION_LABELS[dimensions[1]],
        kind: 'TEXT',
      },
      { key: 'orderCount', label: 'تعداد سفارش', kind: 'NUMBER' },
      { key: 'passengerCount', label: 'تعداد مسافر', kind: 'NUMBER' },
      { key: 'ticketCount', label: 'تعداد بلیت', kind: 'NUMBER' },
      { key: 'salesAmount', label: 'فروش', kind: 'TEXT' },
      { key: 'purchaseAmount', label: 'خرید', kind: 'TEXT' },
      { key: 'grossProfit', label: 'سود ناخالص', kind: 'TEXT' },
      { key: 'refundAmount', label: 'استرداد', kind: 'TEXT' },
      { key: 'settlementBalance', label: 'مانده تسویه', kind: 'TEXT' },
      ...(exposesPendingReservationActions(input.code)
        ? [
            {
              key: 'pendingReservationActions' as const,
              label: 'اقدام رزرو در انتظار',
              kind: 'NUMBER' as const,
            },
          ]
        : []),
    ],
    rows: input.includeAllRows
      ? rows
      : rows.slice(offset, offset + input.query.pageSize),
    total: rows.length,
    page: input.query.page,
    pageSize: input.query.pageSize,
    previewLimit: MAX_PREVIEW_PAGE_SIZE,
    generatedAtUtc,
    sourceDataAsOfUtc: facts.length
      ? new Date(
          Math.max(...facts.map((fact) => fact.dataAsOf.getTime())),
        ).toISOString()
      : null,
    totalsByCurrency,
    filterSnapshot: createFilterSnapshot({
      reportCode: input.code,
      reportVersion: 1,
      grain: 'ORDER_ITEM_CURRENCY',
      query: { ...input.query, sort },
      capturedAtUtc: generatedAtUtc,
    }),
    filterOptions: {
      company: option('legalEntityName'),
      branch: option('branchName'),
      site: option('siteCode'),
      expert: option('ownerName'),
      currency: option('currencyCode'),
      status: option('orderStatus'),
      serviceType: option('serviceType'),
      provider: option('providerName'),
      agency: option('agencyName'),
      route: option('routeLabel'),
    },
    reconciliation: {
      matchesApprovedProjection: true,
      sourceRowCount: facts.length,
    },
    warnings: facts.length
      ? []
      : ['در محدوده انتخاب‌شده رکوردی در Public Projection وجود ندارد.'],
  };
}
