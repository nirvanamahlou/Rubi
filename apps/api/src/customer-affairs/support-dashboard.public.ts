import type { DatabaseClient } from '@nora/database';
import type {
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';

/** Customer support only: internal Workbench and Call Center requests are not support tickets. */
export async function readSupportDashboard(
  client: DatabaseClient,
  query: DashboardSourceQuery,
): Promise<DashboardSourceResult> {
  const source = 'customer-affairs.dashboard.support.v1';
  if (
    !query.actor.permissions.includes('customer_affairs.ticket.read') ||
    !query.actor.branchIds.length
  )
    return { source, state: 'forbidden', metrics: {} };
  if (
    unsupportedDashboardFilters(query, ['branch']) ||
    !['effective', 'created'].includes(query.dateBasis)
  )
    return {
      source,
      state: 'unsupported',
      reason: 'SUPPORT_FILTER_OR_DATE_UNSUPPORTED',
      metrics: {},
    };
  const rows = await client.customerAffairsTicket.findMany({
    where: {
      branchId: {
        in: query.branchId
          ? query.actor.branchIds.filter((b) => b === query.branchId)
          : [...query.actor.branchIds],
      },
      createdAt: { gte: query.from, lt: query.to },
      NOT: [
        { category: 'CALL_CENTER_REQUEST' },
        { category: { startsWith: 'WORKBENCH_' } },
      ],
    },
    select: { createdAt: true, status: true, firstRespondedAt: true },
    take: 10001,
  });
  if (rows.length > 10000)
    return {
      source,
      state: 'unavailable',
      reason: 'SOURCE_ROW_LIMIT',
      metrics: {},
    };
  const active = rows.filter(
    (r) => !['CLOSED', 'RESOLVED', 'CANCELLED'].includes(r.status),
  );
  const first = rows.filter(
    (r) =>
      r.firstRespondedAt &&
      r.firstRespondedAt >= r.createdAt &&
      r.firstRespondedAt < query.to,
  );
  return {
    source,
    state: 'ready',
    metrics: {
      'open-tickets': {
        kind: 'count',
        snapshot: true,
        aggregation:
          'درخواست پشتیبانی ایجادشده در بازه و اکنون باز؛ درخواست داخلی و کال‌سنتر خارج است.',
        observations: active.map((r) => ({
          at: r.createdAt,
          value: '1',
          dimensions: { status: r.status },
        })),
      },
      'support-ticket-count': {
        kind: 'count',
        snapshot: true,
        aggregation: 'درخواست‌های واقعی پشتیبانی به تفکیک وضعیت فعلی.',
        observations: rows.map((r) => ({
          at: r.createdAt,
          value: '1',
          dimensions: { status: r.status },
        })),
      },
      'first-response-time': {
        kind: 'count',
        calculation: 'mean',
        unit: 'دقیقه',
        aggregation:
          'میانگین فاصله ایجاد تا نخستین پاسخ واقعی ثبت‌شده؛ نبود پاسخ صفر دقیقه نیست.',
        observations: first.map((r) => ({
          at: r.firstRespondedAt!,
          value: String(
            (r.firstRespondedAt!.getTime() - r.createdAt.getTime()) / 60000,
          ),
        })),
      },
    },
  };
}
