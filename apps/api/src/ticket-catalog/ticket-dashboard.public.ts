import { dashboardDimensionKey } from '../common/dashboard-dimensions';
import { Prisma, type DatabaseClient } from '@nora/database';
import type {
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';
import { readTicketCapacityReporting } from './ticket-reporting.public';
import { reportingCityLabels } from '../master-data/reporting-cities.public';

/** Ticket-owned current inventory. No released allocation or expired hold is a sale. */
export async function readTicketDashboard(
  client: DatabaseClient,
  query: DashboardSourceQuery,
): Promise<DashboardSourceResult> {
  const source = 'tickets.dashboard.current-capacity.v1';
  if (
    !query.actor.permissions.includes('ticket_catalog.read') ||
    !query.actor.branchIds.length
  )
    return { source, state: 'forbidden', metrics: {} };
  if (
    unsupportedDashboardFilters(query, ['branch']) ||
    query.dateBasis !== 'effective'
  )
    return {
      source,
      state: 'unsupported',
      reason: 'INVENTORY_FILTER_OR_DATE_UNSUPPORTED',
      metrics: {},
    };
  const report = await readTicketCapacityReporting(client, query.actor, {
    filters: {
      fromUtc: query.from.toISOString(),
      toUtc: query.to.toISOString(),
      ...(query.branchId ? { branch: query.branchId } : {}),
      status: 'ACTIVE',
    },
  });
  const ids = report.rows.map((r) => r.id);
  const references = await client.ticketPublishedOffer.findMany({
    where: { id: { in: ids } },
    select: { id: true, originId: true, destinationId: true },
  });
  const labels = await reportingCityLabels(
    client,
    references.flatMap((r) => [r.originId, r.destinationId]),
  );
  const routes = new Map(
    references.map((r) => [
      r.id,
      `${labels.get(r.originId) ?? 'مبدأ ثبت‌نشده'} ← ${labels.get(r.destinationId) ?? 'مقصد ثبت‌نشده'}`,
    ]),
  );
  const routeKeys = new Map(
    references.map((r) => [
      r.id,
      dashboardDimensionKey('route', r.originId, r.destinationId),
    ]),
  );
  const observations = (key: string) =>
    report.rows.map((r) => ({
      at: r.at,
      value: String(r.values[key]),
      dimensions: { route: routes.get(r.id) ?? 'مسیر ثبت‌نشده' },
      dimensionKeys: {
        route: routeKeys.get(r.id) ?? dashboardDimensionKey('offer', r.id),
      },
    }));
  const total = report.rows.reduce(
    (n, r) => n.plus(String(r.values.capacity)),
    new Prisma.Decimal(0),
  );
  const allocated = report.rows.reduce(
    (n, r) => n.plus(String(r.values.allocated)),
    new Prisma.Decimal(0),
  );
  return {
    source,
    state: 'ready',
    metrics: {
      'active-offers': {
        kind: 'count',
        snapshot: true,
        aggregation:
          'پیشنهادهای دارای وضعیت فعال در بازه حرکت انتخابی؛ وضعیت فعلی، بدون مقایسه تاریخی ساختگی.',
        observations: report.rows.map((r) => ({
          at: r.at,
          value: '1',
          dimensions: { route: routes.get(r.id) ?? 'مسیر ثبت‌نشده' },
          dimensionKeys: {
            route: routeKeys.get(r.id) ?? dashboardDimensionKey('offer', r.id),
          },
        })),
      },
      'remaining-capacity': {
        kind: 'count',
        snapshot: true,
        aggregation:
          'ظرفیت کل منهای تخصیص فعال؛ نگه‌داشت موقت و تخصیص آزادشده فروش قطعی محسوب نمی‌شوند.',
        observations: report.rows.map((r) => ({
          at: r.at,
          value: new Prisma.Decimal(String(r.values.capacity))
            .minus(String(r.values.allocated))
            .toString(),
          dimensions: { route: routes.get(r.id) ?? 'مسیر ثبت‌نشده' },
          dimensionKeys: {
            route: routeKeys.get(r.id) ?? dashboardDimensionKey('offer', r.id),
          },
        })),
      },
      'inventory-allocated': {
        kind: 'count',
        snapshot: true,
        aggregation: 'تخصیص‌های فعال ظرفیت به تفکیک مسیر.',
        observations: observations('allocated'),
      },
      'inventory-free': {
        kind: 'count',
        snapshot: true,
        aggregation: 'ظرفیت قابل فروش پس از کسر تخصیص و نگه‌داشت فعال.',
        observations: observations('remaining'),
      },
      'inventory-held': {
        kind: 'count',
        snapshot: true,
        aggregation: 'نگه‌داشت‌های فعال و منقضی‌نشده ظرفیت به تفکیک مسیر.',
        observations: observations('held'),
      },
      ...(total.gt(0)
        ? {
            'sell-through-rate': {
              kind: 'count' as const,
              unit: 'درصد',
              snapshot: true,
              aggregation:
                'جمع تخصیص فعال تقسیم بر جمع ظرفیت عرضه‌های انتخابی، ضرب در صد؛ میانگین وزنی ظرفیت.',
              observations: [
                {
                  at: new Date(query.to.getTime() - 1),
                  value: allocated
                    .div(total)
                    .mul(100)
                    .toDecimalPlaces(4)
                    .toString(),
                },
              ],
            },
          }
        : {}),
    },
  };
}
