import type { DatabaseClient } from '@nora/database';
import {
  boundedSource,
  reportColumn,
  requireSourcePermission,
  sourceBranches,
  sourceFilters,
  type ReportSource,
  type ReportSourceActor,
  type ReportSourceQuery,
} from '../common/report-source';

/** Inventory allocations and live holds, never an estimate based on passenger rows. */
export async function readTicketCapacityReporting(
  client: DatabaseClient,
  actor: ReportSourceActor,
  query: ReportSourceQuery,
): Promise<ReportSource> {
  requireSourcePermission(actor, ['ticket_catalog.read']);
  const { scalar, range } = sourceFilters(query, [
    'fromUtc',
    'toUtc',
    'branch',
    'status',
  ]);
  const now = new Date();
  const rows = boundedSource(
    await client.ticketPublishedOffer.findMany({
      where: {
        branchId: { in: sourceBranches(actor, scalar('branch')) },
        departureAt: range,
        ...(scalar('status') ? { status: scalar('status')! } : {}),
      },
      select: {
        id: true,
        departureAt: true,
        createdAt: true,
        carrierName: true,
        serviceNumber: true,
        totalCapacity: true,
        status: true,
        capacityAllocations: {
          where: { status: 'ACTIVE' },
          select: { quantity: true, createdAt: true },
        },
        capacityHolds: {
          where: { status: 'ACTIVE', expiresAt: { gt: now } },
          select: { quantity: true, createdAt: true },
        },
      },
      take: 10001,
    }),
  );
  return {
    projection: 'tickets.reporting.capacity.v1',
    chartMeasure: 'allocated',
    columns: [
      reportColumn('primaryDimension', 'پرواز'),
      reportColumn('secondaryDimension', 'زمان حرکت UTC'),
      reportColumn('status', 'وضعیت'),
      reportColumn('capacity', 'ظرفیت کل', 'NUMBER'),
      reportColumn('allocated', 'تخصیص فعال', 'NUMBER'),
      reportColumn('held', 'نگه‌داشت فعال', 'NUMBER'),
      reportColumn('remaining', 'ظرفیت باقی‌مانده', 'NUMBER'),
    ],
    rows: rows.map((r) => {
      const allocated = r.capacityAllocations.reduce(
          (s, a) => s + a.quantity,
          0,
        ),
        held = r.capacityHolds.reduce((s, h) => s + h.quantity, 0);
      return {
        id: r.id,
        at: r.departureAt,
        updatedAt: new Date(
          Math.max(
            r.createdAt.getTime(),
            ...r.capacityAllocations.map((a) => a.createdAt.getTime()),
            ...r.capacityHolds.map((h) => h.createdAt.getTime()),
          ),
        ),
        values: {
          primaryDimension: `${r.carrierName} · ${r.serviceNumber}`,
          secondaryDimension: r.departureAt.toISOString(),
          status: r.status,
          capacity: r.totalCapacity,
          allocated,
          held,
          remaining: r.totalCapacity - allocated - held,
        },
      };
    }),
    warnings: [
      'بازه تاریخ بر اساس حرکت پرواز است. نگه‌داشت منقضی یا آزادشده حذف می‌شود؛ تخصیص ظرفیت به معنی صدور بلیت نیست. ظرفیت منفی برای آشکارشدن مغایرت پنهان نمی‌شود.',
    ],
  };
}
