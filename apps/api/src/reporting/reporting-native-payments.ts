import { Prisma, type DatabaseClient } from '@nora/database';
import { BadRequestException } from '@nestjs/common';
import { readSalesPaymentReportingProjection } from '../sales/sales-payment-reporting.public';
import type { SalesReportingActor } from '../sales/sales-reporting.public';
import type {
  ReportQueryV1,
  TravelReportResultV1,
} from './reporting.contracts';
import type { ReportingFactRow } from './reporting.repository';
import { buildTravelReportResult } from './reporting.projection';

export async function nativePaymentReport(
  client: DatabaseClient,
  query: ReportQueryV1,
  actor: SalesReportingActor,
  includeAllRows = false,
): Promise<TravelReportResultV1> {
  const source = await readSalesPaymentReportingProjection(
    client,
    actor,
    query,
  );
  const allowed = new Set([
    'primaryDimension',
    'secondaryDimension',
    'currencyCode',
    'orderCount',
    'salesAmount',
    'refundAmount',
  ]);
  if (query.sort && !allowed.has(query.sort.column))
    throw new BadRequestException('ستون مرتب‌سازی گزارش مجاز نیست.');
  const facts: ReportingFactRow[] = source.map((row) => ({
    id: row.id,
    orderNumber: row.id,
    occurredAt: row.at,
    legalEntityCode: '',
    legalEntityName: '',
    branchId: null,
    branchName: '',
    ownerName: '',
    siteCode: '',
    salesChannel: row.method,
    serviceType: '',
    customerType: '',
    customerName: '',
    agencyName: null,
    leadSource: null,
    providerName: null,
    airlineName: null,
    originCity: null,
    destinationCity: null,
    routeLabel: null,
    orderStatus: '',
    reservationStatus: '',
    issueStatus: '',
    paymentStatus: row.kind,
    pnrCode: null,
    passengerCount: 0,
    segmentCount: 0,
    ticketCount: 0,
    currencyCode: row.currencyCode,
    salesAmount: new Prisma.Decimal(row.received),
    purchaseAmount: new Prisma.Decimal(0),
    commissionAmount: new Prisma.Decimal(0),
    refundAmount: new Prisma.Decimal(row.refunded),
    settledAmount: new Prisma.Decimal(0),
    dataAsOf: row.updatedAt,
  }));
  const result = buildTravelReportResult({
    code: 'payments_refunds',
    query: {
      ...query,
      branchIds: actor.permissions.includes('sales.contracts.read.all')
        ? []
        : actor.branchIds,
    },
    facts,
    now: new Date(),
    includeAllRows,
  });
  const labels: Record<string, string> = {
    primaryDimension: 'نوع تراکنش',
    secondaryDimension: 'روش دریافت',
    orderCount: 'تعداد تراکنش',
    salesAmount: 'دریافت تأییدشده',
    refundAmount: 'استرداد قطعی',
  };
  return {
    ...result,
    grain: 'PAYMENT',
    sourceProjection: 'sales.reporting.payment-events.v1',
    filterSnapshot: { ...result.filterSnapshot, grain: 'PAYMENT' },
    columns: result.columns
      .filter((column) => allowed.has(column.key))
      .map((column) => ({
        ...column,
        label: labels[column.key] ?? column.label,
      })),
    warnings: [
      ...result.warnings,
      'فقط دریافت‌های تأییدشده مشتری و استردادهای قطعی نمایش داده می‌شوند؛ پرداخت تأمین‌کننده در این گزارش نیست.',
    ],
  };
}
