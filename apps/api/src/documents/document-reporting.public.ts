import type { DatabaseClient } from '@nora/database';
import { allowedDocumentDomains } from './documents.repository';
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

/** Uses the catalogue's domain/branch/deletion boundaries; confidential metadata excluded. */
export async function readDocumentComplianceReporting(
  client: DatabaseClient,
  actor: ReportSourceActor,
  query: ReportSourceQuery,
): Promise<ReportSource> {
  requireSourcePermission(actor, ['documents.read']);
  const { scalar, range } = sourceFilters(query, [
    'fromUtc',
    'toUtc',
    'branch',
  ]);
  const rows = boundedSource(
    await client.document.findMany({
      where: {
        branchId: { in: sourceBranches(actor, scalar('branch')) },
        documentType: {
          domain: { in: allowedDocumentDomains(actor.permissions) },
        },
        archiveStatus: { not: 'DELETED' },
        confidentiality: 'INTERNAL',
        createdAt: range,
        NOT: {
          sourceModule: 'WORKBENCH',
          sourceEntityType: 'WorkbenchFeedback',
          ownerUserId: { not: actor.userId },
        },
      },
      select: {
        id: true,
        sourceModule: true,
        isIncomplete: true,
        validUntil: true,
        createdAt: true,
        updatedAt: true,
        currentVersion: { select: { scanStatus: true } },
      },
      take: 10001,
    }),
  );
  const now = new Date();
  const groups = new Map<
    string,
    {
      source: string;
      scan: string;
      count: number;
      incomplete: number;
      expired: number;
      at: Date;
      updatedAt: Date;
    }
  >();
  for (const row of rows) {
    const scan = row.currentVersion?.scanStatus ?? 'NO_VERSION',
      source = row.sourceModule ?? 'GENERAL',
      key = `${source}:${scan}`;
    const g = groups.get(key) ?? {
      source,
      scan,
      count: 0,
      incomplete: 0,
      expired: 0,
      at: row.createdAt,
      updatedAt: row.updatedAt,
    };
    g.count++;
    if (row.isIncomplete) g.incomplete++;
    if (row.validUntil && row.validUntil < now) g.expired++;
    if (row.updatedAt > g.updatedAt) g.updatedAt = row.updatedAt;
    groups.set(key, g);
  }
  return {
    projection: 'documents.reporting.compliance.v1',
    chartMeasure: 'recordCount',
    columns: [
      reportColumn('primaryDimension', 'ماژول مبدأ سند'),
      reportColumn('secondaryDimension', 'وضعیت اسکن'),
      reportColumn('recordCount', 'تعداد سند', 'NUMBER'),
      reportColumn('incomplete', 'ناقص', 'NUMBER'),
      reportColumn('expired', 'منقضی', 'NUMBER'),
    ],
    rows: [...groups].map(([id, g]) => ({
      id,
      at: g.at,
      updatedAt: g.updatedAt,
      values: {
        primaryDimension: g.source,
        secondaryDimension: g.scan,
        recordCount: g.count,
        incomplete: g.incomplete,
        expired: g.expired,
      },
    })),
    warnings: [
      'فقط فراداده اسناد داخلیِ مجاز و حذف‌نشده بررسی می‌شود؛ اسناد محرمانه و ضمیمه بازخورد دیگران حذف می‌شوند. فایل و اطلاعات شخصی صادر نمی‌شود.',
    ],
  };
}
