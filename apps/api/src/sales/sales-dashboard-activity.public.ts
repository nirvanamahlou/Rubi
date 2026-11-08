import { dashboardDimensionKey } from '../common/dashboard-dimensions';
import type { Prisma, DatabaseClient } from '@nora/database';
import type {
  DashboardObservation,
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';
import { reportingIdentityLabels } from '../iam/reporting-directory.public';

/** Sales owns contract events and hotel selections; a cancellation is not a refund. */
export async function readSalesDashboardActivity(
  client: DatabaseClient,
  query: DashboardSourceQuery,
): Promise<DashboardSourceResult> {
  const source = 'sales.dashboard.activity-stays.v1';
  const all = query.actor.permissions.includes('sales.contracts.read.all');
  const branch = query.actor.permissions.includes(
    'sales.contracts.read.branch',
  );
  const own = query.actor.permissions.includes('sales.contracts.read.own');
  if (!all && ((!branch && !own) || !query.actor.branchIds.length))
    return { source, state: 'forbidden', metrics: {} };
  if (
    unsupportedDashboardFilters(query, ['branch']) ||
    !['effective', 'created'].includes(query.dateBasis)
  )
    return {
      source,
      state: 'unsupported',
      reason: 'SALES_FILTER_OR_DATE_BASIS_UNSUPPORTED',
      metrics: {},
    };
  const scope: Prisma.SalesContractWhereInput = {
    ...(!all ? { branchId: { in: [...query.actor.branchIds] } } : {}),
    ...(!all && !branch ? { ownerUserId: query.actor.userId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
  };
  const range = { gte: query.from, lt: query.to };
  const rows = await client.salesContract.findMany({
    where: {
      AND: [
        scope,
        {
          OR: [
            { createdAt: range },
            { confirmedAt: range },
            {
              statusHistory: {
                some: { toStatus: 'CANCELLED', changedAt: range },
              },
            },
          ],
        },
      ],
    },
    select: {
      ownerUserId: true,
      createdAt: true,
      confirmedAt: true,
      status: true,
      statusHistory: {
        where: { toStatus: 'CANCELLED', changedAt: range },
        select: { changedAt: true },
      },
      hotelSelection: {
        select: {
          hotelId: true,
          hotelNameSnapshot: true,
          checkInDate: true,
          checkOutDate: true,
          additionalStays: {
            select: {
              hotelId: true,
              hotelNameSnapshot: true,
              checkInDate: true,
              checkOutDate: true,
            },
          },
        },
      },
    },
    take: 10001,
  });
  if (rows.length > 10000)
    return {
      source,
      state: 'unavailable',
      reason: 'SOURCE_ROW_LIMIT',
      metrics: {},
    };
  const names = await reportingIdentityLabels(
    client,
    [],
    rows.map((r) => r.ownerUserId),
  );
  const created: DashboardObservation[] = [],
    cancelled: DashboardObservation[] = [],
    hotels: DashboardObservation[] = [],
    nights: DashboardObservation[] = [];
  for (const r of rows) {
    const dimensionKeys = {
      agent: dashboardDimensionKey('agent', r.ownerUserId),
    };
    const dimensions = {
      agent: names.users.get(r.ownerUserId) ?? 'کارشناس ثبت‌نشده',
    };
    if (r.createdAt >= query.from && r.createdAt < query.to)
      created.push({ at: r.createdAt, value: '1', dimensions, dimensionKeys });
    for (const event of r.statusHistory)
      cancelled.push({
        at: event.changedAt,
        value: '1',
        dimensions,
        dimensionKeys,
      });
    const at = query.dateBasis === 'created' ? r.createdAt : r.confirmedAt;
    if (
      !at ||
      at < query.from ||
      at >= query.to ||
      ![
        'CONFIRMED',
        'SENT_TO_RESERVATIONS',
        'IN_PROGRESS',
        'COMPLETED',
      ].includes(r.status) ||
      !r.hotelSelection
    )
      continue;
    const stay = r.hotelSelection;
    // Contract/hotel grain: the same hotel is counted at most once per contract.
    const seen = new Set<string>();
    for (const h of [stay, ...stay.additionalStays]) {
      if (!seen.has(h.hotelId)) {
        hotels.push({
          at,
          value: '1',
          dimensions: { hotel: h.hotelNameSnapshot },
          dimensionKeys: { hotel: dashboardDimensionKey('hotel', h.hotelId) },
        });
        seen.add(h.hotelId);
      }
      const days =
        (h.checkOutDate.getTime() - h.checkInDate.getTime()) / 86400000;
      if (days > 0 && Number.isInteger(days))
        nights.push({
          at,
          value: String(days),
          dimensions: { hotel: h.hotelNameSnapshot },
          dimensionKeys: { hotel: dashboardDimensionKey('hotel', h.hotelId) },
        });
    }
  }
  return {
    source,
    state: 'ready',
    metrics: {
      'cancelled-orders': {
        kind: 'count',
        aggregation:
          'رخداد واقعی تغییر وضعیت به لغوشده بر اساس زمان تغییر؛ مستقل از مبلغ استرداد.',
        observations: cancelled,
      },
      'employee-cancellation-count': {
        kind: 'count',
        aggregation: 'رخداد لغو قراردادهای منتسب به کارشناس مالک قرارداد.',
        observations: cancelled,
      },
      'employee-contract-count': {
        kind: 'count',
        aggregation: 'قرارداد ایجادشده در بازه، یک‌بار به نام مالک قرارداد.',
        observations: created,
      },
      'hotel-reservations': {
        kind: 'count',
        aggregation:
          'هر قرارداد نهایی‌شده و هتل مستقل یک‌بار؛ تعداد اتاق باعث تکثیر نمی‌شود.',
        observations: hotels,
      },
      'average-stay-length': {
        kind: 'count',
        calculation: 'mean',
        unit: 'شب',
        aggregation:
          'میانگین شب اقامت‌های معتبر هتل در قراردادهای نهایی‌شده؛ تاریخ خروج منهای ورود.',
        observations: nights,
      },
    },
  };
}
