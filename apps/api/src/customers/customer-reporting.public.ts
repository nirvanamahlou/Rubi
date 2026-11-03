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

/** Customer registrations, not paid-purchase acquisition or passenger-only identities. */
export async function readCustomerReporting(
  client: DatabaseClient,
  actor: ReportSourceActor,
  query: ReportSourceQuery,
): Promise<ReportSource> {
  requireSourcePermission(actor, ['customers.read']);
  const { scalar, range } = sourceFilters(query, [
    'fromUtc',
    'toUtc',
    'branch',
  ]);
  const rows = boundedSource(
    await client.customer.findMany({
      where: {
        ownerBranchId: { in: sourceBranches(actor, scalar('branch')) },
        isCustomer: true,
        mergedIntoId: null,
        createdAt: range,
      },
      select: { id: true, createdAt: true, updatedAt: true, kind: true },
      take: 10001,
    }),
  );
  const groups = new Map<
    string,
    { at: Date; updatedAt: Date; count: number; kind: string }
  >();
  for (const row of rows) {
    const month = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: 'long',
    }).format(row.createdAt);
    const key = `${month}:${row.kind}`;
    const g = groups.get(key) ?? {
      at: row.createdAt,
      updatedAt: row.updatedAt,
      count: 0,
      kind: row.kind,
    };
    g.count++;
    if (row.updatedAt > g.updatedAt) g.updatedAt = row.updatedAt;
    groups.set(key, g);
  }
  return {
    projection: 'customers.reporting.registrations.v1',
    chartMeasure: 'recordCount',
    columns: [
      reportColumn('primaryDimension', 'ماه ثبت مشتری'),
      reportColumn('secondaryDimension', 'نوع مشتری'),
      reportColumn('recordCount', 'مشتری ثبت‌شده', 'NUMBER'),
    ],
    rows: [...groups].map(([id, g]) => ({
      id,
      at: g.at,
      updatedAt: g.updatedAt,
      values: {
        primaryDimension: new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
          timeZone: 'Asia/Tehran',
          year: 'numeric',
          month: 'long',
        }).format(g.at),
        secondaryDimension:
          g.kind === 'ORGANIZATION'
            ? 'سازمانی'
            : g.kind === 'PERSON'
              ? 'حقیقی'
              : g.kind,
        recordCount: g.count,
      },
    })),
    warnings: [
      'این گزارش ثبت هویت مشتری را می‌شمارد؛ مسافرِ بدون نقش مشتری و هویت ادغام‌شده حذف می‌شوند. ثبت مشتری به معنی خرید موفق نیست.',
    ],
  };
}
