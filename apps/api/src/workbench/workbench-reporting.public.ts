import type { DatabaseClient } from '@nora/database';
import { hasAccessControl } from '@nora/contracts';
import { ForbiddenException } from '@nestjs/common';
import {
  boundedSource,
  reportColumn,
  sourceBranches,
  sourceFilters,
  type ReportSource,
  type ReportSourceActor,
  type ReportSourceQuery,
} from '../common/report-source';

/** Personal calendar access never expands to colleagues through reporting permissions. */
export async function readDueWorkbenchReporting(
  client: DatabaseClient,
  actor: ReportSourceActor,
  query: ReportSourceQuery,
): Promise<ReportSource> {
  if (!hasAccessControl(actor.permissions, 'workbench.tab.calendar'))
    throw new ForbiddenException('مجوز مشاهده منبع این گزارش وجود ندارد.');
  const { scalar, range } = sourceFilters(query, [
    'fromUtc',
    'toUtc',
    'branch',
  ]);
  const now = new Date();
  const rows = boundedSource(
    await client.workbenchCalendarEvent.findMany({
      where: {
        userId: actor.userId,
        branchId: { in: sourceBranches(actor, scalar('branch')) },
        status: 'PLANNED',
        AND: [{ dueAt: { lt: now } }, { dueAt: range }],
      },
      select: {
        id: true,
        title: true,
        dueAt: true,
        updatedAt: true,
        priority: true,
      },
      take: 10001,
    }),
  );
  return {
    projection: 'workbench.reporting.due-actions.v1',
    chartMeasure: 'overdueDays',
    columns: [
      reportColumn('primaryDimension', 'پیگیری شخصی'),
      reportColumn('secondaryDimension', 'اولویت'),
      reportColumn('dueAt', 'موعد UTC'),
      reportColumn('overdueDays', 'روز تأخیر', 'NUMBER'),
    ],
    rows: rows.map((r) => ({
      id: r.id,
      at: r.dueAt,
      updatedAt: r.updatedAt,
      values: {
        primaryDimension: r.title,
        secondaryDimension: r.priority,
        dueAt: r.dueAt.toISOString(),
        overdueDays: Math.max(
          0,
          Math.floor((now.getTime() - r.dueAt.getTime()) / 86400000),
        ),
      },
    })),
    warnings: [
      'فقط رویدادهای برنامه‌ریزی‌شده و عقب‌افتاده تقویم حساب جاری نمایش داده می‌شوند؛ وظایف دیگر کاربران وارد گزارش نمی‌شوند.',
    ],
  };
}
