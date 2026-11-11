import type { DatabaseClient, Prisma } from '@nora/database';

type InvoiceQueueRevision = {
  sourceId: string;
  sourceVersion: number;
  version: number;
  status: string;
  cumulativePaid: Prisma.Decimal;
  remainingAmount: Prisma.Decimal;
};

/** Read the latest Finance revision for each already-authorized procurement handoff. */
export async function readFinanceInvoiceQueueStates(
  database: DatabaseClient,
  sourceIds: readonly string[],
) {
  const ids = [...new Set(sourceIds)];
  if (!ids.length) return new Map<string, InvoiceQueueRevision>();
  const rows = await database.$queryRaw<InvoiceQueueRevision[]>`
    SELECT selected.id AS "sourceId", revision."sourceVersion",
           revision.version, revision.status,
           revision."cumulativePaid", revision."remainingAmount"
    FROM unnest(${ids}::uuid[]) AS selected(id)
    JOIN LATERAL (
      SELECT "sourceVersion", version, status, "cumulativePaid", "remainingAmount"
      FROM finance_procurement_invoice_revisions
      WHERE "sourceId" = selected.id
      ORDER BY version DESC
      LIMIT 1
    ) AS revision ON true
  `;
  return new Map(rows.map((row) => [row.sourceId, row]));
}
