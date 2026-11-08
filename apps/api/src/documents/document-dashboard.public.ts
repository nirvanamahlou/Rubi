import type { DatabaseClient } from '@nora/database';
import type {
  DashboardSourceQuery,
  DashboardSourceResult,
} from '../common/dashboard-source';
import { unsupportedDashboardFilters } from '../common/dashboard-source';
import { readDocumentComplianceReporting } from './document-reporting.public';

/** Reuses Documents confidentiality, domain, branch and deletion boundaries. */
export async function readDocumentDashboard(
  client: DatabaseClient,
  query: DashboardSourceQuery,
): Promise<DashboardSourceResult> {
  const source = 'documents.dashboard.compliance.v1';
  if (
    !query.actor.permissions.includes('documents.list') ||
    !query.actor.branchIds.length
  )
    return { source, state: 'forbidden', metrics: {} };
  if (
    unsupportedDashboardFilters(query, ['branch']) ||
    !['created', 'effective'].includes(query.dateBasis)
  )
    return {
      source,
      state: 'unsupported',
      reason: 'DOCUMENT_FILTER_OR_DATE_UNSUPPORTED',
      metrics: {},
    };
  const result = await readDocumentComplianceReporting(client, query.actor, {
    filters: {
      fromUtc: query.from.toISOString(),
      toUtc: query.to.toISOString(),
      ...(query.branchId ? { branch: query.branchId } : {}),
    },
  });
  const metric = (key: string) => ({
    kind: 'count' as const,
    snapshot: true,
    aggregation:
      'اسناد داخلی مجاز، حذف‌نشده و ایجادشده در بازه؛ وضعیت فعلی کیفیت سند، بدون افشای محتوای محرمانه.',
    observations: result.rows.map((r) => ({
      at: r.at,
      value: String(r.values[key]),
      dimensions: {
        source: String(r.values.primaryDimension),
        scan: String(r.values.secondaryDimension),
      },
    })),
  });
  return {
    source,
    state: 'ready',
    metrics: {
      'document-count': metric('recordCount'),
      'document-incomplete': metric('incomplete'),
      'document-expired': metric('expired'),
    },
  };
}
