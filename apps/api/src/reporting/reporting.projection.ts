import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@nora/database';

import type { ReportQueryV1, TravelReportResultV1, TravelReportRowV1 } from './reporting.contracts';
import type { ReportingFactRow } from './reporting.repository';
import { createFilterSnapshot, MAX_PREVIEW_PAGE_SIZE } from './reporting.policy';

type DimensionKey = keyof Pick<ReportingFactRow,
  'salesChannel' | 'serviceType' | 'providerName' | 'agencyName' | 'customerType' |
  'reservationStatus' | 'issueStatus' | 'paymentStatus' | 'leadSource' | 'routeLabel' |
  'destinationCity' | 'airlineName' | 'legalEntityName' | 'branchName' | 'ownerName'>;

const REPORT_DIMENSIONS: Readonly<Record<string, readonly [DimensionKey, DimensionKey]>> = {
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
};

const DIMENSION_LABELS: Readonly<Record<DimensionKey, string>> = {
  salesChannel: 'کانال فروش', serviceType: 'نوع خدمت', providerName: 'تأمین‌کننده',
  agencyName: 'آژانس', customerType: 'نوع مشتری', reservationStatus: 'وضعیت رزرو',
  issueStatus: 'وضعیت صدور', paymentStatus: 'وضعیت پرداخت', leadSource: 'منبع لید',
  routeLabel: 'مسیر سفر', destinationCity: 'شهر مقصد', airlineName: 'شرکت هواپیمایی',
  legalEntityName: 'شرکت', branchName: 'شعبه', ownerName: 'کارشناس',
};

function amount(value: Prisma.Decimal | string) { return new Prisma.Decimal(value); }
function text(value: unknown) { return typeof value === 'string' && value.trim() ? value : 'نامشخص'; }

export function buildTravelReportResult(input: {
  code: string;
  query: ReportQueryV1;
  facts: readonly ReportingFactRow[];
  now: Date;
}): TravelReportResultV1 {
  const dimensions = REPORT_DIMENSIONS[input.code];
  if (!dimensions) throw new BadRequestException('این گزارش به Projection سفر متصل نشده است.');
  const groups = new Map<string, TravelReportRowV1 & { orderIds: Set<string> }>();
  for (const fact of input.facts) {
    const primaryDimension = text(fact[dimensions[0]]);
    const secondaryDimension = text(fact[dimensions[1]]);
    const key = `${primaryDimension}\u001f${secondaryDimension}\u001f${fact.currencyCode}`;
    const current = groups.get(key) ?? {
      grainId: key, primaryDimension, secondaryDimension, currencyCode: fact.currencyCode,
      orderCount: 0, passengerCount: 0, ticketCount: 0,
      salesAmount: '0', purchaseAmount: '0', grossProfit: '0', refundAmount: '0', settlementBalance: '0',
      orderIds: new Set<string>(),
    };
    current.orderIds.add(fact.orderNumber);
    current.orderCount = current.orderIds.size;
    current.passengerCount += fact.passengerCount;
    current.ticketCount += fact.ticketCount;
    current.salesAmount = amount(current.salesAmount).plus(fact.salesAmount).toString();
    current.purchaseAmount = amount(current.purchaseAmount).plus(fact.purchaseAmount).toString();
    current.grossProfit = amount(current.grossProfit).plus(fact.salesAmount).minus(fact.purchaseAmount).plus(fact.commissionAmount).toString();
    current.refundAmount = amount(current.refundAmount).plus(fact.refundAmount).toString();
    current.settlementBalance = amount(current.settlementBalance).plus(fact.salesAmount).minus(fact.refundAmount).minus(fact.settledAmount).toString();
    groups.set(key, current);
  }
  const sortable = new Set<keyof TravelReportRowV1>(['primaryDimension', 'secondaryDimension', 'currencyCode', 'orderCount', 'passengerCount', 'ticketCount', 'salesAmount', 'purchaseAmount', 'grossProfit', 'refundAmount', 'settlementBalance']);
  const sort = input.query.sort ?? { column: 'salesAmount', direction: 'DESC' as const };
  if (!sortable.has(sort.column as keyof TravelReportRowV1)) throw new BadRequestException('ستون مرتب‌سازی گزارش مجاز نیست.');
  const rows = [...groups.values()].map((group) => ({
    grainId: group.grainId, primaryDimension: group.primaryDimension,
    secondaryDimension: group.secondaryDimension, currencyCode: group.currencyCode,
    orderCount: group.orderCount, passengerCount: group.passengerCount,
    ticketCount: group.ticketCount, salesAmount: group.salesAmount,
    purchaseAmount: group.purchaseAmount, grossProfit: group.grossProfit,
    refundAmount: group.refundAmount, settlementBalance: group.settlementBalance,
  }));
  rows.sort((left, right) => {
    const l = left[sort.column as keyof TravelReportRowV1];
    const r = right[sort.column as keyof TravelReportRowV1];
    const compared = ['salesAmount', 'purchaseAmount', 'grossProfit', 'refundAmount', 'settlementBalance'].includes(sort.column)
      ? amount(String(l)).comparedTo(amount(String(r)))
      : typeof l === 'number' && typeof r === 'number' ? l - r : String(l).localeCompare(String(r), 'fa');
    return compared * (sort.direction === 'ASC' ? 1 : -1);
  });
  const currencies = [...new Set(input.facts.map((fact) => fact.currencyCode))];
  const totalsByCurrency = currencies.map((currencyCode) => {
    const scoped = input.facts.filter((fact) => fact.currencyCode === currencyCode);
    const sum = (select: (fact: ReportingFactRow) => Prisma.Decimal) => scoped.reduce((total, fact) => total.plus(select(fact)), new Prisma.Decimal(0)).toString();
    return {
      currencyCode,
      salesAmount: sum((fact) => fact.salesAmount),
      purchaseAmount: sum((fact) => fact.purchaseAmount),
      grossProfit: sum((fact) => fact.salesAmount.minus(fact.purchaseAmount).plus(fact.commissionAmount)),
      refundAmount: sum((fact) => fact.refundAmount),
      settlementBalance: sum((fact) => fact.salesAmount.minus(fact.refundAmount).minus(fact.settledAmount)),
    };
  });
  const generatedAtUtc = input.now.toISOString();
  const offset = (input.query.page - 1) * input.query.pageSize;
  const option = (key: keyof ReportingFactRow) => [...new Set(input.facts.map((fact) => text(fact[key])))].sort((a, b) => a.localeCompare(b, 'fa'));
  return {
    reportCode: input.code, reportVersion: 1, grain: 'ORDER_ITEM_CURRENCY', sourceProjection: 'reporting.travel.facts.v1',
    columns: [
      { key: 'primaryDimension', label: DIMENSION_LABELS[dimensions[0]], kind: 'TEXT' },
      { key: 'secondaryDimension', label: DIMENSION_LABELS[dimensions[1]], kind: 'TEXT' },
      { key: 'currencyCode', label: 'ارز', kind: 'TEXT' }, { key: 'orderCount', label: 'تعداد سفارش', kind: 'NUMBER' },
      { key: 'passengerCount', label: 'تعداد مسافر', kind: 'NUMBER' }, { key: 'ticketCount', label: 'تعداد بلیت', kind: 'NUMBER' },
      { key: 'salesAmount', label: 'فروش', kind: 'MONEY' }, { key: 'purchaseAmount', label: 'خرید', kind: 'MONEY' },
      { key: 'grossProfit', label: 'سود ناخالص', kind: 'MONEY' }, { key: 'refundAmount', label: 'استرداد', kind: 'MONEY' },
      { key: 'settlementBalance', label: 'مانده تسویه', kind: 'MONEY' },
    ],
    rows: rows.slice(offset, offset + input.query.pageSize), total: rows.length, page: input.query.page, pageSize: input.query.pageSize,
    previewLimit: MAX_PREVIEW_PAGE_SIZE, generatedAtUtc,
    sourceDataAsOfUtc: input.facts.length ? new Date(Math.max(...input.facts.map((fact) => fact.dataAsOf.getTime()))).toISOString() : null,
    totalsByCurrency,
    filterSnapshot: createFilterSnapshot({ reportCode: input.code, reportVersion: 1, grain: 'ORDER_ITEM_CURRENCY', query: { ...input.query, sort }, capturedAtUtc: generatedAtUtc }),
    filterOptions: { company: option('legalEntityName'), branch: option('branchName'), site: option('siteCode'), expert: option('ownerName'), currency: option('currencyCode'), status: option('orderStatus'), serviceType: option('serviceType'), provider: option('providerName'), agency: option('agencyName'), route: option('routeLabel') },
    reconciliation: { matchesApprovedProjection: true, sourceRowCount: input.facts.length },
    warnings: input.facts.length ? [] : ['در محدوده انتخاب‌شده رکوردی در Public Projection وجود ندارد.'],
  };
}
