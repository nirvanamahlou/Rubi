import { Prisma, type DatabaseClient } from '@nora/database';
import { BadRequestException } from '@nestjs/common';
import {
  readSalesReportingProjection,
  type SalesReportingActor,
} from '../sales/sales-reporting.public';
import { reportingIdentityLabels } from '../iam/reporting-directory.public';
import { reportingCityLabels } from '../master-data/reporting-cities.public';
import type { ReportQueryV1 } from './reporting.contracts';
import type { ReportingFactRow } from './reporting.repository';
import { buildTravelReportResult } from './reporting.projection';

export const NATIVE_SALES_REPORTS = new Set([
  'sales_by_organization',
  'route_passengers',
  'sales_contract_pipeline',
  'sales_by_service_route',
]);

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

export async function nativeSalesReport(
  client: DatabaseClient,
  code: string,
  query: ReportQueryV1,
  actor: SalesReportingActor,
  includeAllRows = false,
) {
  if (
    query.sort &&
    ![
      'primaryDimension',
      'secondaryDimension',
      'currencyCode',
      'orderCount',
      'passengerCount',
      'salesAmount',
    ].includes(query.sort.column)
  )
    throw new BadRequestException(
      'مرتب‌سازی انتخاب‌شده در این گزارش پشتیبانی نمی‌شود.',
    );
  const source = await readSalesReportingProjection(
    client,
    actor,
    query,
    code === 'sales_contract_pipeline',
  );
  const [directory, cities] = await Promise.all([
    reportingIdentityLabels(
      client,
      source.map((row) => row.branchId),
      source.map((row) => row.ownerUserId),
    ),
    reportingCityLabels(
      client,
      source.flatMap((row) => [row.originId, row.destinationId]),
    ),
  ]);
  const facts: ReportingFactRow[] = source.map((row) => ({
    id: `${row.id}:${row.currencyCode}`,
    orderNumber: row.id,
    occurredAt: row.occurredAt,
    legalEntityCode: '',
    legalEntityName: 'شرکت صادرکننده ثبت نشده',
    branchId: row.branchId,
    branchName: directory.branches.get(row.branchId) ?? row.branchId,
    ownerName: directory.users.get(row.ownerUserId) ?? row.ownerUserId,
    siteCode: 'ثبت نشده',
    salesChannel: 'ثبت نشده',
    serviceType:
      row.serviceKinds.map((kind) => serviceLabels[kind] ?? kind).join(' + ') ||
      'خدمت ثبت نشده',
    customerType: 'ثبت نشده',
    customerName: '',
    agencyName: null,
    leadSource: null,
    providerName: null,
    airlineName: null,
    originCity: cities.get(row.originId) ?? row.originId,
    destinationCity: cities.get(row.destinationId) ?? row.destinationId,
    routeLabel: `${cities.get(row.originId) ?? row.originId} ← ${cities.get(row.destinationId) ?? row.destinationId}`,
    orderStatus: row.status,
    reservationStatus: row.reservationStatus,
    issueStatus: 'UNKNOWN',
    paymentStatus: 'UNKNOWN',
    pnrCode: null,
    passengerCount: row.passengerCount,
    segmentCount: 0,
    ticketCount: 0,
    currencyCode: row.currencyCode,
    salesAmount: new Prisma.Decimal(row.salesAmount),
    purchaseAmount: new Prisma.Decimal(0),
    commissionAmount: new Prisma.Decimal(0),
    refundAmount: new Prisma.Decimal(0),
    settledAmount: new Prisma.Decimal(0),
    dataAsOf: row.dataAsOf,
  }));
  const identities = new Map(
    source.map((row) => [`${row.id}:${row.currencyCode}`, row]),
  );
  const result = buildTravelReportResult({
    code,
    query: {
      ...query,
      branchIds: actor.permissions.includes('sales.contracts.read.all')
        ? []
        : actor.branchIds,
    },
    facts,
    now: new Date(),
    includeAllRows,
    ...(code === 'sales_by_organization'
      ? { dimensionOverride: ['branchName', 'ownerName'] as const }
      : {}),
    ...(code === 'sales_by_organization' ||
    code === 'route_passengers' ||
    code === 'sales_by_service_route'
      ? {
          dimensionIdentity: (
            fact: ReportingFactRow,
          ): readonly [string, string] => {
            const row = identities.get(fact.id)!;
            return code === 'sales_by_organization'
              ? [row.branchId, row.ownerUserId]
              : [
                  code === 'sales_by_service_route'
                    ? row.serviceKinds.join('+')
                    : row.destinationId,
                  `${row.originId}:${row.destinationId}`,
                ];
          },
        }
      : {}),
  });
  return {
    ...result,
    reportVersion: code === 'sales_by_organization' ? 3 : 1,
    sourceProjection: 'sales.reporting.contract-currency.v1' as const,
    grain: 'CONTRACT_CURRENCY' as const,
    columns: result.columns
      .filter((column) =>
        [
          'primaryDimension',
          'secondaryDimension',
          'currencyCode',
          'orderCount',
          'passengerCount',
          'salesAmount',
        ].includes(column.key),
      )
      .map((column) =>
        column.key === 'orderCount'
          ? { ...column, label: 'تعداد قرارداد' }
          : column.key === 'salesAmount'
            ? { ...column, label: 'مبلغ قرارداد' }
            : code === 'sales_by_service_route' &&
                column.key === 'primaryDimension'
              ? { ...column, label: 'ترکیب خدمات قرارداد' }
              : column,
      ),
    filterSnapshot: {
      ...result.filterSnapshot,
      reportVersion: code === 'sales_by_organization' ? 3 : 1,
      grain: 'CONTRACT_CURRENCY' as const,
    },
    filterOptions: {
      ...result.filterOptions,
      branch: [...new Set(source.map((row) => row.branchId))],
      expert: [...new Set(source.map((row) => row.ownerUserId))],
    },
    filterOptionLabels: Object.fromEntries([
      ...directory.branches,
      ...directory.users,
    ]),
    warnings: [
      ...result.warnings,
      'مبالغ فروش از قیمت مصوب قرارداد خوانده می‌شوند؛ خرید، سود، وصول و صدور در این گزارش محاسبه نمی‌شوند.',
    ],
  };
}
