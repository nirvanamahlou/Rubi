import type { DatabaseClient } from '@nora/database';
import type {
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';
import { readSalesReportingEligibility } from '../sales/sales-reporting-eligibility.public';

/** Counts actual native issued documents, never passenger allocations or purchases. */
export async function readReservationDashboard(
  client: DatabaseClient,
  query: DashboardSourceQuery,
): Promise<DashboardSourceResult> {
  const source = 'reservations.dashboard.issued-documents.v1';
  if (
    !query.actor.permissions.includes('reservations.read') ||
    !query.actor.branchIds.length
  )
    return { source, state: 'forbidden', metrics: {} };
  if (
    unsupportedDashboardFilters(query, ['branch']) ||
    !['effective', 'issued'].includes(query.dateBasis)
  )
    return {
      source,
      state: 'unsupported',
      reason: 'ISSUE_FILTER_OR_DATE_UNSUPPORTED',
      metrics: {},
    };
  const eligible = await readSalesReportingEligibility(client, query.actor);
  const rows = await client.reservationTicketDocument.findMany({
    where: {
      issuedAt: { gte: query.from, lt: query.to },
      intake: {
        branchId: {
          in: query.branchId
            ? query.actor.branchIds.filter((b) => b === query.branchId)
            : [...query.actor.branchIds],
        },
        contractId: { in: eligible },
      },
    },
    select: { issuedAt: true },
    take: 10001,
  });
  if (rows.length > 10000)
    return {
      source,
      state: 'unavailable',
      reason: 'SOURCE_ROW_LIMIT',
      metrics: {},
    };
  return {
    source,
    state: 'ready',
    metrics: {
      'issued-documents': {
        kind: 'count',
        aggregation:
          'اسناد واقعی صدور ثبت‌شده برای قراردادهای جاری واجد شرایط، بر اساس زمان صدور؛ تخصیص مسافر یا ثبت خرید سند محسوب نمی‌شود.',
        observations: rows.map((r) => ({ at: r.issuedAt, value: '1' })),
      },
    },
  };
}
