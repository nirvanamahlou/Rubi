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

export async function readHrExpiryReporting(
  client: DatabaseClient,
  actor: ReportSourceActor,
  query: ReportSourceQuery,
): Promise<ReportSource> {
  requireSourcePermission(actor, ['hr.read', 'hr.manage']);
  const { scalar, range } = sourceFilters(query, [
    'fromUtc',
    'toUtc',
    'branch',
    'status',
  ]);
  const status = scalar('status');
  const now = new Date();
  const rows = boundedSource(
    await client.hrRecord.findMany({
      where: {
        branchId: { in: sourceBranches(actor, scalar('branch')) },
        deletedAt: null,
        expiresAt: {
          not: null,
          ...range,
          ...(!range.lt ? { lt: new Date(now.getTime() + 30 * 86400000) } : {}),
        },
        ...(status ? { status } : {}),
      },
      select: {
        id: true,
        code: true,
        section: true,
        tab: true,
        expiresAt: true,
        updatedAt: true,
        status: true,
      },
      take: 10001,
    }),
  );
  return {
    projection: 'hr.reporting.record-expiry.v1',
    chartMeasure: 'recordCount',
    columns: [
      reportColumn('primaryDimension', 'کد سابقه'),
      reportColumn('secondaryDimension', 'نوع سابقه'),
      reportColumn('expiresAt', 'انقضا UTC'),
      reportColumn('recordCount', 'تعداد سابقه', 'NUMBER'),
    ],
    rows: rows.flatMap((r) =>
      r.expiresAt
        ? [
            {
              id: r.id,
              at: r.expiresAt,
              updatedAt: r.updatedAt,
              values: {
                primaryDimension: r.code,
                secondaryDimension: r.section + '/' + r.tab,
                expiresAt: r.expiresAt.toISOString().slice(0, 10),
                status: r.status,
                recordCount: 1,
              },
            },
          ]
        : [],
    ),
    warnings: [
      'فقط سوابق دارای تاریخ انقضای صریح نمایش داده می‌شوند؛ تاریخ از متن مدارک حدس زده نمی‌شود. در نبود بازه، سوابق منقضی و سی روز آینده بررسی می‌شوند.',
    ],
  };
}
