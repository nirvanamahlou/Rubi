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

/** No call-center pseudo-SLA and no descriptions, contact details or encrypted payloads. */
export async function readTicketSlaReporting(
  client: DatabaseClient,
  actor: ReportSourceActor,
  query: ReportSourceQuery,
): Promise<ReportSource> {
  requireSourcePermission(actor, ['customer_affairs.ticket.read']);
  const { scalar, range } = sourceFilters(query, [
    'fromUtc',
    'toUtc',
    'branch',
    'status',
  ]);
  const status = scalar('status');
  const tickets = boundedSource(
    await client.customerAffairsTicket.findMany({
      where: {
        branchId: { in: sourceBranches(actor, scalar('branch')) },
        createdAt: range,
        slaPolicyVersion: { not: 'CALL_CENTER_NO_SLA' },
        ...(status ? { status } : {}),
      },
      select: {
        id: true,
        branchId: true,
        executionUnit: true,
        status: true,
        firstResponseDueAt: true,
        resolutionDueAt: true,
        firstRespondedAt: true,
        resolvedAt: true,
        closedAt: true,
        pausedAt: true,
        firstResponseBreachedAt: true,
        resolutionBreachedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      take: 10001,
    }),
  );
  const now = new Date();
  const groups = new Map<
    string,
    {
      unit: string;
      status: string;
      count: number;
      response: number;
      resolution: number;
      at: Date;
      updatedAt: Date;
    }
  >();
  for (const r of tickets) {
    const unit = r.executionUnit ?? 'واحد ثبت نشده';
    const id = JSON.stringify([r.branchId, unit, r.status]);
    const g = groups.get(id) ?? {
      unit,
      status: r.status,
      count: 0,
      response: 0,
      resolution: 0,
      at: r.createdAt,
      updatedAt: r.updatedAt,
    };
    g.count++;
    if (
      r.firstResponseBreachedAt ||
      (!r.pausedAt &&
        (r.firstRespondedAt ?? r.closedAt ?? now) > r.firstResponseDueAt)
    )
      g.response++;
    if (
      r.resolutionBreachedAt ||
      (!r.pausedAt && (r.resolvedAt ?? r.closedAt ?? now) > r.resolutionDueAt)
    )
      g.resolution++;
    if (r.updatedAt > g.updatedAt) g.updatedAt = r.updatedAt;
    groups.set(id, g);
  }
  return {
    projection: 'customer-affairs.reporting.sla.v1',
    chartMeasure: 'recordCount',
    columns: [
      reportColumn('primaryDimension', 'واحد رسیدگی'),
      reportColumn('secondaryDimension', 'وضعیت'),
      reportColumn('recordCount', 'درخواست دارای SLA', 'NUMBER'),
      reportColumn('responseBreaches', 'عبور از مهلت پاسخ', 'NUMBER'),
      reportColumn('resolutionBreaches', 'عبور از مهلت حل', 'NUMBER'),
    ],
    rows: [...groups].map(([id, g]) => ({
      id,
      at: g.at,
      updatedAt: g.updatedAt,
      values: {
        primaryDimension: g.unit,
        secondaryDimension: g.status,
        status: g.status,
        recordCount: g.count,
        responseBreaches: g.response,
        resolutionBreaches: g.resolution,
      },
    })),
    warnings: [
      'بازه بر اساس ثبت درخواست است؛ درخواست‌های کال سنتر بدون SLA حذف می‌شوند و توقف زمان رسیدگی رعایت می‌شود.',
    ],
  };
}
