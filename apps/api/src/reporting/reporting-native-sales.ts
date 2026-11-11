import { readOrganizationReportCustomers } from '../customers/customer-reporting.public';
import { Prisma, type DatabaseClient } from '@nora/database';
import { BadRequestException } from '@nestjs/common';
import {
  scanSalesReportingPages,
  type SalesReportingActor,
} from '../sales/sales-reporting.public';
import { reportingIdentityLabels } from '../iam/reporting-directory.public';
import { reportingCityLabels } from '../master-data/reporting-cities.public';
import type {
  ReportQueryV1,
  TravelReportResultV1,
} from './reporting.contracts';
import { createOrganizationMultiCurrencyProjection } from './reporting-organization-multicurrency';
import { createTravelReportProjection } from './reporting.projection';

export const NATIVE_SALES_REPORTS = new Set([
  'sales_by_organization',
  'route_passengers',
  'sales_contract_pipeline',
  'sales_by_service_route',
  'agency_performance',
  'future_travel_commitments',
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
  const today =
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date()) + 'T00:00:00.000Z';
  const effectiveQuery =
    code === 'future_travel_commitments'
      ? {
          ...query,
          filters: {
            ...query.filters,
            fromUtc:
              typeof query.filters.fromUtc === 'string' &&
              query.filters.fromUtc > today
                ? query.filters.fromUtc
                : today,
          },
        }
      : query;
  const organizations = new Map<string, string>();
  const directory = {
    branches: new Map<string, string>(),
    users: new Map<string, string>(),
  };
  const cities = new Map<string, string>();
  const queriedCustomers = new Set<string>();
  const queriedBranches = new Set<string>();
  const queriedUsers = new Set<string>();
  const queriedCities = new Set<string>();
  const sourceBranches = new Set<string>();
  const sourceUsers = new Set<string>();
  const projection = createTravelReportProjection({
    code,
    query: {
      ...effectiveQuery,
      branchIds: actor.permissions.includes('sales.contracts.read.all')
        ? []
        : actor.branchIds,
    },
    includeAllRows,
    ...(code === 'sales_by_organization'
      ? { dimensionOverride: ['branchName', 'ownerName'] as const }
      : code === 'future_travel_commitments'
        ? { dimensionOverride: ['destinationCity', 'routeLabel'] as const }
        : {}),
  });
  const contractProjection = createOrganizationMultiCurrencyProjection(
    query,
    includeAllRows,
    directory,
    code === 'agency_performance'
      ? {
          labels: ['مشتری سازمانی', 'شعبه'],
          dimensions: (row) => [
            row.customerId,
            row.branchId,
            organizations.get(row.customerId)!,
            directory.branches.get(row.branchId) ?? row.branchId,
          ],
        }
      : code === 'route_passengers' || code === 'future_travel_commitments'
        ? {
            labels: ['شهر مقصد', 'مسیر سفر'],
            dimensions: (row) => [
              row.destinationId,
              JSON.stringify([row.originId, row.destinationId]),
              cities.get(row.destinationId) ?? row.destinationId,
              `${cities.get(row.originId) ?? row.originId} ← ${cities.get(row.destinationId) ?? row.destinationId}`,
            ],
          }
        : code === 'sales_contract_pipeline'
          ? {
              labels: ['وضعیت قرارداد', 'وضعیت رزرو'],
              dimensions: (row) => [
                row.status,
                row.reservationStatus,
                row.status,
                row.reservationStatus,
              ],
            }
          : code === 'sales_by_service_route'
            ? {
                labels: ['ترکیب خدمات قرارداد', 'مسیر سفر'],
                dimensions: (row) => [
                  JSON.stringify(row.serviceKinds),
                  JSON.stringify([row.originId, row.destinationId]),
                  row.serviceKinds
                    .map((kind) => serviceLabels[kind] ?? kind)
                    .join(' + ') || 'خدمت ثبت نشده',
                  `${cities.get(row.originId) ?? row.originId} ← ${cities.get(row.destinationId) ?? row.destinationId}`,
                ],
              }
            : undefined,
  );
  let checkedOrganizationScope = false;
  for await (const page of scanSalesReportingPages(
    client,
    actor,
    effectiveQuery,
    code === 'sales_contract_pipeline',
    code === 'future_travel_commitments' ? 'departure' : 'created',
  )) {
    if (code === 'agency_performance') {
      const ids = newLookupIds(
        page.map((row) => row.customerId),
        queriedCustomers,
      );
      if (ids.length || !checkedOrganizationScope) {
        const names = await readOrganizationReportCustomers(client, actor, ids);
        for (const [id, name] of names) organizations.set(id, name);
        checkedOrganizationScope = true;
      }
    }
    const visible =
      code === 'agency_performance'
        ? page.filter((row) => organizations.has(row.customerId))
        : page;
    const branchIds = newLookupIds(
      visible.map((row) => row.branchId),
      queriedBranches,
    );
    const userIds = newLookupIds(
      visible.map((row) => row.ownerUserId),
      queriedUsers,
    );
    const cityIds = newLookupIds(
      visible.flatMap((row) => [row.originId, row.destinationId]),
      queriedCities,
    );
    const [names, cityNames] = await Promise.all([
      branchIds.length || userIds.length
        ? reportingIdentityLabels(client, branchIds, userIds)
        : undefined,
      cityIds.length ? reportingCityLabels(client, cityIds) : undefined,
    ]);
    for (const [id, name] of names?.branches ?? [])
      directory.branches.set(id, name);
    for (const [id, name] of names?.users ?? []) directory.users.set(id, name);
    for (const [id, name] of cityNames ?? []) cities.set(id, name);
    for (const row of visible) {
      sourceBranches.add(row.branchId);
      sourceUsers.add(row.ownerUserId);
      contractProjection.add(row);
      projection.add(
        {
          id: `${row.id}:${row.currencyCode}`,
          sourceItemId: row.id,
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
            row.serviceKinds
              .map((kind) => serviceLabels[kind] ?? kind)
              .join(' + ') || 'خدمت ثبت نشده',
          customerType: 'ثبت نشده',
          customerName: '',
          agencyName: organizations.get(row.customerId) ?? null,
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
        },
        code === 'sales_by_organization'
          ? [row.branchId, row.ownerUserId]
          : code === 'route_passengers' ||
              code === 'sales_by_service_route' ||
              code === 'future_travel_commitments'
            ? [
                code === 'sales_by_service_route'
                  ? row.serviceKinds.join('+')
                  : row.destinationId,
                `${row.originId}:${row.destinationId}`,
              ]
            : undefined,
      );
    }
  }
  const result = projection.finish(new Date());
  const response: TravelReportResultV1 = {
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
      branch: [...sourceBranches],
      expert: [...sourceUsers],
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
  return NATIVE_SALES_REPORTS.has(code)
    ? contractProjection.finish(response)
    : response;
}

function newLookupIds(ids: readonly string[], seen: Set<string>) {
  const missing: string[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    missing.push(id);
  }
  return missing;
}
