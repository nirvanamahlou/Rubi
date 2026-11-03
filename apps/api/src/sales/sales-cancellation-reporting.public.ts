import { BadRequestException } from '@nestjs/common';
import { Prisma, type DatabaseClient } from '@nora/database';
import { reportingIdentityLabels } from '../iam/reporting-directory.public';
import {
  reportColumn,
  sourceFilters,
  type ReportSource,
  type ReportSourceActor,
  type ReportSourceQuery,
} from '../common/report-source';
import { readSalesReportingProjection } from './sales-reporting.public';

/** Cancellation amounts are a separate measure, never confirmed sales or executed refunds. */
export async function readSalesCancellationReporting(
  client: DatabaseClient,
  actor: ReportSourceActor,
  query: ReportSourceQuery,
): Promise<ReportSource> {
  const { scalar } = sourceFilters(query, [
    'fromUtc',
    'toUtc',
    'branch',
    'expert',
    'currencyCode',
    'status',
  ]);
  if (scalar('status') && scalar('status') !== 'CANCELLED')
    throw new BadRequestException(
      'این گزارش فقط قراردادهای باطل‌شده را نمایش می‌دهد.',
    );
  const rows = await readSalesReportingProjection(
    client,
    actor,
    { ...query, filters: { ...query.filters, status: 'CANCELLED' } },
    true,
  );
  const labels = await reportingIdentityLabels(
    client,
    rows.map((r) => r.branchId),
    rows.map((r) => r.ownerUserId),
  );
  const groups = new Map<
    string,
    {
      branch: string;
      owner: string;
      currency: string;
      amount: Prisma.Decimal;
      count: number;
      at: Date;
      updatedAt: Date;
    }
  >();
  for (const r of rows) {
    const id = JSON.stringify([r.branchId, r.ownerUserId, r.currencyCode]);
    const g = groups.get(id) ?? {
      branch: r.branchId,
      owner: r.ownerUserId,
      currency: r.currencyCode,
      amount: new Prisma.Decimal(0),
      count: 0,
      at: r.occurredAt,
      updatedAt: r.dataAsOf,
    };
    g.amount = g.amount.add(r.salesAmount);
    g.count++;
    if (r.dataAsOf > g.updatedAt) g.updatedAt = r.dataAsOf;
    groups.set(id, g);
  }
  return {
    projection: 'sales.reporting.cancellations.v1',
    chartMeasure: 'cancelledAmount',
    columns: [
      reportColumn('primaryDimension', 'شعبه'),
      reportColumn('secondaryDimension', 'کارشناس'),
      reportColumn('currencyCode', 'ارز'),
      reportColumn('recordCount', 'قرارداد باطل‌شده', 'NUMBER'),
      reportColumn('cancelledAmount', 'مبلغ قرارداد باطل‌شده', 'MONEY'),
    ],
    rows: [...groups].map(([id, g]) => ({
      id,
      at: g.at,
      updatedAt: g.updatedAt,
      values: {
        primaryDimension: labels.branches.get(g.branch) ?? g.branch,
        secondaryDimension: labels.users.get(g.owner) ?? g.owner,
        currencyCode: g.currency,
        recordCount: g.count,
        cancelledAmount: g.amount.toString(),
      },
    })),
    warnings: [
      'بازه بر اساس زمان ایجاد قراردادهایی است که اکنون باطل‌اند، نه تاریخ ابطال. مبلغ ابطال از فروش تأییدشده جداست و به معنی استرداد اجراشده یا علت لغو رزرواسیون نیست.',
    ],
  };
}
