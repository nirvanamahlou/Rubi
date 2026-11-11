import { Prisma } from '@nora/database';
import * as v from './accounting.validation';
import { reportMonth } from './accounting-report-calendar';

export const journalBrowserAxes = [
  'user',
  'type',
  'status',
  'daily',
  'monthly',
] as const;
export type JournalBrowserAxis = (typeof journalBrowserAxes)[number];
export type JournalBrowserObservation = {
  id: string;
  actorId: string | null;
  kind: 'issued' | 'changed' | 'reviewed';
  typeId: string | null;
  status: string;
  documentDate: string | null;
  lineCount: number;
  historicalGap: boolean;
};
export function journalBrowserRows(
  observations: JournalBrowserObservation[],
  axis: JournalBrowserAxis,
  calendar: 'PERSIAN' | 'GREGORIAN' = 'GREGORIAN',
) {
  const groups = new Map<
    string,
    {
      key: string;
      issued: number;
      issuedLines: number;
      changed: number;
      changedLines: number;
      reviewed: number;
      historicalGap: boolean;
      journalIds: Set<string>;
    }
  >();
  const seen = new Set<string>();
  for (const item of observations) {
    let key: string;
    if (axis === 'user') key = item.actorId ?? '';
    else if (axis === 'type') key = item.typeId ?? '';
    else if (axis === 'status') key = item.status;
    else if (axis === 'daily') key = item.documentDate ?? '';
    else if (item.documentDate) {
      key = reportMonth(item.documentDate, calendar);
    } else key = '';
    // A journal changed/reviewed repeatedly by one user counts once in that group.
    const token = JSON.stringify([key, item.id, item.kind]);
    if (seen.has(token)) continue;
    seen.add(token);
    const row = groups.get(key) ?? {
      key,
      issued: 0,
      issuedLines: 0,
      changed: 0,
      changedLines: 0,
      reviewed: 0,
      historicalGap: false,
      journalIds: new Set<string>(),
    };
    row.journalIds.add(item.id);
    row.historicalGap ||= item.historicalGap;
    if (item.kind === 'issued') {
      row.issued++;
      row.issuedLines += item.lineCount;
    }
    if (item.kind === 'changed') {
      row.changed++;
      row.changedLines += item.lineCount;
    }
    if (item.kind === 'reviewed') row.reviewed++;
    groups.set(key, row);
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** Journal identities remain constrained by the same book/period/filter CTE in every branch. */
export async function journalBrowserObservations(
  tx: Prisma.TransactionClient,
  bookId: string,
  periodId: string,
  from: string,
  to: string,
) {
  const rows = await tx.$queryRaw<JournalBrowserObservation[]>(Prisma.sql`
    WITH selected AS (
      SELECT j.id,j."bookId",j."makerId",j."typeId",j.status,j."documentDate", (SELECT COUNT(*)::integer FROM accounting_journal_lines l WHERE l."journalId"=j.id) AS "lineCount"
      FROM accounting_journals j WHERE j."bookId"=${bookId}::uuid
      AND j."periodId"=${periodId}::uuid AND j."documentDate">=${from} AND j."documentDate"<=${to}
    ), saves AS (
      SELECT DISTINCT ON (j.id,c."actorId") j.id,c."actorId"
      FROM selected j JOIN accounting_commands c ON c."bookId"=j."bookId" AND c.result->>'id'=j.id::text
      WHERE c.action IN ('journal-save','journal-document-save','journal-memorandum-save')
      AND CASE WHEN c.result->>'version' ~ '^[0-9]+$' THEN (c.result->>'version')::numeric>1 ELSE false END
      ORDER BY j.id,c."actorId",c."createdAt" DESC,c.id DESC
    ), observations AS (
      SELECT j.id,e."actorId",'issued' AS kind,j."typeId",j.status,j."documentDate",
        j."lineCount",
        e.id IS NULL AS "historicalGap"
      FROM selected j LEFT JOIN LATERAL (
        SELECT e.id,e."actorId" FROM accounting_journal_state_events e
        WHERE e."bookId"=j."bookId" AND e."journalId"=j.id AND e."eventType"='CREATE'
        ORDER BY e."occurredAt",e.id LIMIT 1
      ) e ON true
      UNION ALL
      SELECT j.id,s."actorId",'changed',j."typeId",j.status,j."documentDate",
        j."lineCount",false
      FROM selected j JOIN saves s ON s.id=j.id
      UNION ALL
      SELECT DISTINCT j.id,e."actorId",'reviewed',j."typeId",j.status,j."documentDate",j."lineCount",false
      FROM selected j JOIN accounting_journal_state_events e ON e."bookId"=j."bookId" AND e."journalId"=j.id
      WHERE e."eventType"='STATUS' AND e."toStatus"='APPROVED'
    ) SELECT * FROM observations ORDER BY id,kind,"actorId" LIMIT 20001
  `);
  if (rows.length > 20000)
    v.rule('محدوده مرور اسناد بیش از حد بزرگ است؛ بازه تاریخ را محدود کنید.');
  return rows;
}
