import { dashboardDimensionKey } from '../common/dashboard-dimensions';
import { Prisma, type DatabaseClient } from '@nora/database';
import type {
  DashboardObservation,
  DashboardSourceMetric,
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';

/** HR-only daily attendance, using accepted records and actual normalized minutes. */
export async function readHrDashboard(
  client: DatabaseClient,
  query: DashboardSourceQuery,
): Promise<DashboardSourceResult> {
  const source = 'hr.dashboard.accepted-attendance.v1';
  if (
    !query.actor.permissions.some((p) =>
      ['hr.read', 'hr.manage'].includes(p),
    ) ||
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
      reason: 'HR_FILTER_OR_DATE_UNSUPPORTED',
      metrics: {},
    };
  const rows = await client.hrRecord.findMany({
    where: {
      branchId: {
        in: query.branchId
          ? query.actor.branchIds.filter((b) => b === query.branchId)
          : [...query.actor.branchIds],
      },
      section: 'time',
      tab: 'attendance',
      deletedAt: null,
      employee: { deletedAt: null },
      employeeId: { not: null },
      effectiveAt: { gte: query.from, lt: query.to },
    },
    select: {
      id: true,
      branchId: true,
      employeeId: true,
      effectiveAt: true,
      updatedAt: true,
      status: true,
      data: true,
      employee: { select: { unit: true, organizationBranchId: true } },
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
  const latest = new Map<string, (typeof rows)[number]>();
  for (const r of rows) {
    if (!r.employeeId || !r.effectiveAt) continue;
    const key = `${r.employeeId}:${r.effectiveAt.toISOString().slice(0, 10)}`;
    const previous = latest.get(key);
    if (
      !previous ||
      r.updatedAt > previous.updatedAt ||
      (r.updatedAt.getTime() === previous.updatedAt.getTime() &&
        r.id > previous.id)
    )
      latest.set(key, r);
  }
  const days: DashboardObservation[] = [],
    overtime: DashboardObservation[] = [];
  let missingWork = false,
    missingOvertime = false;
  for (const r of latest.values()) {
    // A pending review or absence is not confirmed work, even if it carries minute fields.
    if (!['حاضر', 'تأییدشده', 'تاییدشده'].includes(r.status)) continue;
    if (!r.data || typeof r.data !== 'object' || Array.isArray(r.data)) {
      missingWork = true;
      missingOvertime = true;
      continue;
    }
    const worked = r.data.workedMinutes,
      extra = r.data.overtimeMinutes;
    if (typeof worked !== 'number' || !Number.isFinite(worked) || worked < 0) {
      missingWork = true;
      missingOvertime = true;
      continue;
    }
    if (worked === 0) continue;
    if (typeof extra !== 'number' || !Number.isFinite(extra) || extra < 0)
      missingOvertime = true;
    const at = r.effectiveAt!,
      dimensions = { unit: r.employee?.unit || 'واحد ثبت‌نشده' };
    const dimensionKeys = {
      unit: dashboardDimensionKey(
        'hr-unit',
        r.employee?.organizationBranchId ?? r.branchId,
        dimensions.unit,
      ),
    };
    days.push({ at, value: '1', dimensions, dimensionKeys });
    if (typeof extra === 'number' && Number.isFinite(extra) && extra >= 0)
      overtime.push({
        at,
        value: new Prisma.Decimal(extra).div(60).toString(),
        dimensions,
        dimensionKeys,
      });
  }
  const unavailableMetrics: Record<string, string> = {};
  if (missingWork)
    unavailableMetrics['employee-workdays'] = 'MEASUREMENT_INPUTS_REQUIRED';
  if (missingOvertime)
    unavailableMetrics['employee-overtime'] = 'MEASUREMENT_INPUTS_REQUIRED';
  const metrics: Record<string, DashboardSourceMetric> = {
    'employee-workdays': {
      kind: 'count',
      unit: 'روز',
      aggregation:
        'آخرین رکورد معتبر هر کارمند/روز با وضعیت حاضر یا تأییدشده و کارکرد مثبت واقعی؛ رکورد نیازمند بررسی، غیبت و روز غیرکاری حذف می‌شود.',
      observations: days,
    },
    'employee-overtime': {
      kind: 'count',
      unit: 'ساعت',
      aggregation:
        'دقیقه اضافه‌کاری ثبت‌شده در آخرین رکورد حضور معتبر تقسیم بر ۶۰؛ بدون تبدیل روز به ساعت یا محاسبه مبلغ.',
      observations: overtime,
    },
  };
  for (const id of Object.keys(unavailableMetrics)) delete metrics[id];
  return { source, state: 'ready', metrics, unavailableMetrics };
}
