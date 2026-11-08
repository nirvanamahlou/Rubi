import { BadRequestException } from '@nestjs/common';
import { Prisma, type DatabaseClient } from '@nora/database';
import type { ReportSource, ReportSourceActor } from '../common/report-source';
import { readCustomerReporting } from '../customers/customer-reporting.public';
import { readDocumentComplianceReporting } from '../documents/document-reporting.public';
import { readHrAttendanceReporting } from '../hr/hr-reporting.public';
import { readReservationReporting } from '../reservations/reservation-reporting.public';
import { readHotelRateReporting } from '../reservations/hotel-rate-reporting.public';
import { readTicketCapacityReporting } from '../ticket-catalog/ticket-reporting.public';
import { readExportAuditReporting } from './reporting-native-audit';
import { readSalesCancellationReporting } from '../sales/sales-cancellation-reporting.public';
import { reportingIdentityLabels } from '../iam/reporting-directory.public';
import type {
  ReportingGrain,
  ReportQueryV1,
  TravelReportResultV1,
} from './reporting.contracts';
import { createFilterSnapshot } from './reporting.policy';
import { consolidateSourceCurrencies } from './reporting-source-currencies';
import { readTicketSlaReporting } from '../customer-affairs/ticket-reporting.public';
import { readDueWorkbenchReporting } from '../workbench/workbench-reporting.public';
import { readHrExpiryReporting } from '../hr/hr-expiry-reporting.public';

export const OPERATIONAL_REPORTS: Readonly<
  Record<
    string,
    { projection: ReportSource['projection']; grain: ReportingGrain }
  >
> = {
  customer_service_sla: {
    projection: 'customer-affairs.reporting.sla.v1',
    grain: 'TICKET_SUPPORT',
  },
  workbench_due_actions: {
    projection: 'workbench.reporting.due-actions.v1',
    grain: 'TICKET_SUPPORT',
  },
  hr_record_expiry: {
    projection: 'hr.reporting.record-expiry.v1',
    grain: 'EMPLOYEE',
  },
  cancellations_refunds: {
    projection: 'sales.reporting.cancellations.v1',
    grain: 'CONTRACT_CURRENCY',
  },
  purchase_by_supplier: {
    projection: 'reservations.reporting.registered-purchases.v1',
    grain: 'PURCHASE',
  },
  reservation_delivery_readiness: {
    projection: 'reservations.reporting.delivery.v1',
    grain: 'RESERVATION',
  },
  reservation_cycle_time: {
    projection: 'reservations.reporting.delivery.v1',
    grain: 'RESERVATION',
  },
  tickets_manifest: {
    projection: 'reservations.reporting.delivery.v1',
    grain: 'TICKET',
  },
  ticket_capacity: {
    projection: 'tickets.reporting.capacity.v1',
    grain: 'INVENTORY',
  },
  hotel_rate_comparison: {
    projection: 'reservations.reporting.hotel-base-rates.v1',
    grain: 'HOTEL_RATE',
  },
  customer_portfolio_growth: {
    projection: 'customers.reporting.registrations.v1',
    grain: 'CUSTOMER',
  },
  hr_performance: {
    projection: 'hr.reporting.attendance-coverage.v1',
    grain: 'EMPLOYEE',
  },
  document_compliance: {
    projection: 'documents.reporting.compliance.v1',
    grain: 'DOCUMENT',
  },
  export_audit: {
    projection: 'reporting.reporting.own-export-audit.v1',
    grain: 'EXPORT_RUN',
  },
};

/** Same source-column dataset drives preview, charts and file exports. */
export function assembleOperationalResult(
  code: string,
  query: ReportQueryV1,
  actor: ReportSourceActor,
  source: ReportSource,
  includeAllRows = false,
): TravelReportResultV1 {
  const rawSource = source;
  source = consolidateSourceCurrencies(source);
  const definition = OPERATIONAL_REPORTS[code];
  if (!definition || definition.projection !== source.projection)
    throw new Error('Report source mismatch');
  const column =
    query.sort?.column === 'currencyCode' &&
    !source.columns.some((c) => c.key === 'currencyCode')
      ? (source.columns.find((c) => c.key === 'primaryDimension')?.key ??
        source.chartMeasure)
      : query.sort?.column === 'salesAmount' &&
          !source.columns.some((c) => c.key === 'salesAmount')
        ? source.chartMeasure
        : (query.sort?.column ?? source.chartMeasure);
  if (!source.columns.some((c) => c.key === column))
    throw new BadRequestException('ستون مرتب‌سازی گزارش مجاز نیست.');
  const kind = source.columns.find((c) => c.key === column)!.kind;
  const currencyCount = new Set(
    rawSource.rows.map((r) => r.values.currencyCode).filter(Boolean),
  ).size;
  const sorted = [...source.rows].sort((a, b) => {
    const left = a.values[column] ?? '',
      right = b.values[column] ?? '';
    let diff = 0;
    if (
      rawSource.columns.some((c) => c.key === column && c.kind === 'MONEY') &&
      (a.chartAmounts || b.chartAmounts)
    ) {
      // No cross-currency ranking until an FX policy is explicitly approved.
      diff =
        currencyCount === 1 &&
        column === source.chartMeasure &&
        a.chartAmounts?.[0] &&
        b.chartAmounts?.[0]
          ? new Prisma.Decimal(a.chartAmounts[0].amount).comparedTo(
              b.chartAmounts[0].amount,
            )
          : String(a.values.primaryDimension ?? a.id).localeCompare(
              String(b.values.primaryDimension ?? b.id),
              'fa',
            );
    } else if (kind === 'TEXT')
      diff = String(left).localeCompare(String(right), 'fa');
    else {
      const numeric = (v: string | number) =>
        /^-?\d+(?:\.\d+)?$/.test(String(v));
      if (!numeric(left) || !numeric(right))
        return numeric(left)
          ? -1
          : numeric(right)
            ? 1
            : a.id.localeCompare(b.id);
      const l = new Prisma.Decimal(String(left)),
        r = new Prisma.Decimal(String(right));
      diff = l.comparedTo(r);
    }
    return diff
      ? diff * (query.sort?.direction === 'ASC' ? 1 : -1)
      : a.id.localeCompare(b.id);
  });
  const fullRows: TravelReportResultV1['rows'][number][] = sorted.map((r) => ({
    grainId: r.id,
    primaryDimension: String(r.values.primaryDimension ?? ''),
    secondaryDimension: String(r.values.secondaryDimension ?? ''),
    currencyCode: String(r.values.currencyCode ?? ''),
    orderCount: 0,
    passengerCount: 0,
    ticketCount: 0,
    salesAmount: '0',
    purchaseAmount: '0',
    grossProfit: '0',
    refundAmount: '0',
    settlementBalance: '0',
    pendingReservationActions: 0,
    sourceValues: r.values,
    ...(r.chartAmounts ? { amountsByCurrency: r.chartAmounts } : {}),
  }));
  // A count, capacity, rate or registered purchase is not approved sales/profit.
  return {
    reportCode: code,
    reportVersion: 1,
    grain: definition.grain,
    sourceProjection: source.projection,
    dataLayout: 'SOURCE_COLUMNS',
    chartMeasure: source.chartMeasure,
    columns: source.columns,
    rows: includeAllRows
      ? fullRows
      : fullRows.slice(
          (query.page - 1) * query.pageSize,
          query.page * query.pageSize,
        ),
    total: fullRows.length,
    page: query.page,
    pageSize: query.pageSize,
    previewLimit: 100,
    generatedAtUtc: new Date().toISOString(),
    sourceDataAsOfUtc: source.rows.length
      ? new Date(
          Math.max(...source.rows.map((r) => r.updatedAt.getTime())),
        ).toISOString()
      : null,
    totalsByCurrency: [],
    filterSnapshot: createFilterSnapshot({
      reportCode: code,
      reportVersion: 1,
      grain: definition.grain,
      query: {
        ...query,
        branchIds: actor.branchIds,
        sort: { column, direction: query.sort?.direction ?? 'DESC' },
      },
      capturedAtUtc: new Date().toISOString(),
    }),
    filterOptions: {
      branch: actor.branchIds,
      status: [
        ...new Set(
          source.rows.flatMap((r) =>
            typeof r.values.status === 'string' ? [r.values.status] : [],
          ),
        ),
      ],
      currency: [
        ...new Set(
          rawSource.rows.flatMap((r) =>
            typeof r.values.currencyCode === 'string' && r.values.currencyCode
              ? [r.values.currencyCode]
              : [],
          ),
        ),
      ],
    },
    reconciliation: {
      matchesApprovedProjection: true,
      sourceRowCount: source.rows.length,
    },
    warnings: source.warnings,
  };
}

export async function nativeOperationalReport(
  client: DatabaseClient,
  code: string,
  query: ReportQueryV1,
  actor: ReportSourceActor,
  includeAllRows = false,
) {
  let source: ReportSource;
  switch (code) {
    case 'customer_service_sla':
      source = await readTicketSlaReporting(client, actor, query);
      break;
    case 'workbench_due_actions':
      source = await readDueWorkbenchReporting(client, actor, query);
      break;
    case 'hr_record_expiry':
      source = await readHrExpiryReporting(client, actor, query);
      break;
    case 'cancellations_refunds':
      source = await readSalesCancellationReporting(client, actor, query);
      break;
    case 'purchase_by_supplier':
    case 'reservation_delivery_readiness':
    case 'tickets_manifest':
    case 'reservation_cycle_time':
      source = await readReservationReporting(client, code, actor, query);
      break;
    case 'ticket_capacity':
      source = await readTicketCapacityReporting(client, actor, query);
      break;
    case 'hotel_rate_comparison':
      source = await readHotelRateReporting(client, actor, query);
      break;
    case 'customer_portfolio_growth':
      source = await readCustomerReporting(client, actor, query);
      break;
    case 'hr_performance':
      source = await readHrAttendanceReporting(client, actor, query);
      break;
    case 'document_compliance':
      source = await readDocumentComplianceReporting(client, actor, query);
      break;
    case 'export_audit':
      source = await readExportAuditReporting(client, actor, query);
      break;
    default:
      throw new BadRequestException('منبع گزارش منتشر نشده است.');
  }
  const result = assembleOperationalResult(
    code,
    query,
    actor,
    source,
    includeAllRows,
  );
  const labels = await reportingIdentityLabels(client, actor.branchIds, []);
  return { ...result, filterOptionLabels: Object.fromEntries(labels.branches) };
}
