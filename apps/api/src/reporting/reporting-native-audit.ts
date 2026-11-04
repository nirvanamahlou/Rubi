import type { DatabaseClient } from '@nora/database';
import { BadRequestException } from '@nestjs/common';
import {
  boundedSource,
  reportColumn,
  requireSourcePermission,
  sourceFilters,
  type ReportSource,
  type ReportSourceActor,
  type ReportSourceQuery,
} from '../common/report-source';

/** Reports owns these artifacts; even audit readers see only their own exports. */
export async function readExportAuditReporting(
  client: DatabaseClient,
  actor: ReportSourceActor,
  query: ReportSourceQuery,
): Promise<ReportSource> {
  requireSourcePermission(actor, ['reporting.audit.read']);
  const { scalar, range } = sourceFilters(query, [
    'fromUtc',
    'toUtc',
    'status',
  ]);
  const statuses = [
    'QUEUED',
    'GENERATING',
    'READY',
    'FAILED',
    'EXPIRED',
  ] as const;
  const status = scalar('status') as (typeof statuses)[number] | undefined;
  if (status && !statuses.includes(status))
    throw new BadRequestException('وضعیت خروجی معتبر نیست.');
  const now = new Date();
  const rows = boundedSource(
    await client.reportingExportArtifact.findMany({
      where: {
        creatorUserId: actor.userId,
        createdAt: range,
        ...(status === 'EXPIRED'
          ? {
              OR: [
                { status: 'EXPIRED' as const },
                { status: 'READY' as const, expiresAt: { lte: now } },
              ],
            }
          : status === 'READY'
            ? {
                status: 'READY' as const,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              }
            : status
              ? { status }
              : {}),
      },
      select: {
        id: true,
        reportCode: true,
        format: true,
        status: true,
        sizeBytes: true,
        createdAt: true,
        updatedAt: true,
        expiresAt: true,
      },
      take: 10001,
    }),
  );
  return {
    projection: 'reporting.reporting.own-export-audit.v1',
    chartMeasure: 'fileCount',
    columns: [
      reportColumn('primaryDimension', 'کد گزارش'),
      reportColumn('secondaryDimension', 'فرمت'),
      reportColumn('status', 'وضعیت'),
      reportColumn('createdAt', 'زمان ایجاد UTC'),
      reportColumn('expiresAt', 'زمان انقضا UTC'),
      reportColumn('fileBytes', 'اندازه بایت', 'NUMBER'),
      reportColumn('fileCount', 'تعداد فایل', 'NUMBER'),
    ],
    rows: rows.map((r) => ({
      id: r.id,
      at: r.createdAt,
      updatedAt: r.updatedAt,
      values: {
        primaryDimension: r.reportCode,
        secondaryDimension: r.format,
        status:
          r.status === 'READY' && r.expiresAt && r.expiresAt <= now
            ? 'EXPIRED'
            : r.status,
        createdAt: r.createdAt.toISOString(),
        expiresAt: r.expiresAt?.toISOString() ?? 'مشخص نشده',
        fileBytes: r.sizeBytes ?? 'نامشخص',
        fileCount: 1,
      },
    })),
    warnings: [
      'فقط سوابق خروجی ایجادشده توسط حساب جاری نمایش داده می‌شود. فیلترهای خصوصی، نشانی فایل و داده خروجی کاربران دیگر افشا نمی‌شود.',
    ],
  };
}
