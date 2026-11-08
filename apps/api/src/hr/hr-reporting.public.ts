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

/** Non-sensitive daily attendance coverage only. No payroll, biometric or individual PII. */
export async function readHrAttendanceReporting(
  client: DatabaseClient,
  actor: ReportSourceActor,
  query: ReportSourceQuery,
): Promise<ReportSource> {
  // SELF/TEAM alone never authorize organization-wide personnel analytics.
  requireSourcePermission(actor, ['hr.read', 'hr.manage']);
  const { scalar, range } = sourceFilters(query, [
    'fromUtc',
    'toUtc',
    'branch',
    'status',
  ]);
  const rows = boundedSource(
    await client.hrRecord.findMany({
      where: {
        branchId: { in: sourceBranches(actor, scalar('branch')) },
        section: 'time',
        tab: 'attendance',
        NOT: { status: 'غیرفعال' },
        deletedAt: null,
        employee: { deletedAt: null },
        effectiveAt: range,
        ...(scalar('status') ? { status: scalar('status')! } : {}),
      },
      select: {
        id: true,
        effectiveAt: true,
        updatedAt: true,
        status: true,
        employeeId: true,
        employee: { select: { unit: true } },
      },
      take: 10001,
    }),
  );
  const groups = new Map<
    string,
    {
      at: Date;
      updatedAt: Date;
      unit: string;
      status: string;
      employees: Set<string>;
      count: number;
    }
  >();
  for (const row of rows) {
    if (!row.effectiveAt || !row.employeeId) continue;
    const unit = row.employee?.unit || 'واحد ثبت نشده';
    const key = JSON.stringify([
      row.effectiveAt.toISOString(),
      unit,
      row.status,
    ]);
    const g = groups.get(key) ?? {
      at: row.effectiveAt,
      updatedAt: row.updatedAt,
      unit,
      status: row.status,
      employees: new Set<string>(),
      count: 0,
    };
    g.employees.add(row.employeeId);
    g.count++;
    if (row.updatedAt > g.updatedAt) g.updatedAt = row.updatedAt;
    groups.set(key, g);
  }
  return {
    projection: 'hr.reporting.attendance-coverage.v1',
    chartMeasure: 'recordCount',
    columns: [
      reportColumn('primaryDimension', 'تاریخ کارکرد'),
      reportColumn('secondaryDimension', 'واحد سازمانی'),
      reportColumn('status', 'وضعیت کارکرد'),
      reportColumn('recordCount', 'تعداد کارکنان', 'NUMBER'),
      reportColumn('dailyRows', 'ردیف کارکرد', 'NUMBER'),
    ],
    rows: [...groups].map(([id, g]) => ({
      id,
      at: g.at,
      updatedAt: g.updatedAt,
      values: {
        primaryDimension: g.at.toISOString().slice(0, 10),
        secondaryDimension: g.unit,
        status: g.status,
        recordCount: g.employees.size,
        dailyRows: g.count,
      },
    })),
    warnings: [
      'بازه بر اساس روز کارکرد ثبت‌شده است؛ فقط وضعیت و پوشش کارکرد نمایش داده می‌شود. امتیاز عملکرد، غیبت، کسری، اضافه‌کار و حقوق از نبود رکورد استنتاج نمی‌شوند.',
    ],
  };
}
