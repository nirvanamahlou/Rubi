import { Prisma } from '@nora/database';
import type { ProcurementTx } from './procurement.service';

/** r is always the scoped Procurement request; no foreign-module tables are read. */
export const remainingOrder = Prisma.sql`EXISTS (
  SELECT 1 FROM procurement_order_item oi JOIN procurement_order_version ov ON ov.id = oi."orderVersionId" AND ov.version = o.version
  WHERE oi."orderId" = o.id AND oi.quantity >
    COALESCE((SELECT SUM(ri."acceptedQuantity") FROM procurement_receipt_item ri WHERE ri."orderItemId" = oi.id), 0)
    + COALESCE((SELECT SUM(a."acceptedDelta") FROM procurement_receipt_adjustment a JOIN procurement_receipt_item ri ON ri.id = a."receiptItemId" WHERE ri."orderItemId" = oi.id), 0)
    + COALESCE((SELECT SUM(sa.quantity) FROM procurement_service_acceptance sa WHERE sa."orderItemId" = oi.id), 0)
    - COALESCE((SELECT SUM(rt.quantity) FROM procurement_return rt JOIN procurement_receipt_item ri ON ri.id = rt."receiptItemId" WHERE ri."orderItemId" = oi.id AND COALESCE(rt.data->>'disposition', 'ACCEPTED') = 'ACCEPTED'), 0))`;

export function operationalQueue(queue: string): Prisma.Sql | null {
  if (queue === 'late')
    return Prisma.sql`EXISTS (SELECT 1 FROM procurement_order o WHERE o."requestId" = r.id AND o.status = 'ISSUED' AND o."expectedAt" < CURRENT_TIMESTAMP AND ${remainingOrder})`;
  if (queue === 'partial')
    return Prisma.sql`EXISTS (SELECT 1 FROM procurement_order o WHERE o."requestId" = r.id AND o.status = 'ISSUED' AND ${remainingOrder} AND (EXISTS (SELECT 1 FROM procurement_receipt g WHERE g."orderId" = o.id) OR EXISTS (SELECT 1 FROM procurement_service_acceptance s WHERE s."orderId" = o.id)))`;
  if (queue === 'discrepant')
    return Prisma.sql`EXISTS (SELECT 1 FROM procurement_invoice i WHERE i."requestId" = r.id AND i.status = 'MISMATCH')`;
  if (queue === 'finance')
    return Prisma.sql`EXISTS (SELECT 1 FROM procurement_invoice i WHERE i."requestId" = r.id AND i.status = 'WAITING_FINANCE')`;
  return null;
}

export async function procurementReport(
  tx: ProcurementTx,
  scope: Prisma.Sql,
  dimension: string,
  page: number,
) {
  const group =
    dimension === 'unit'
      ? Prisma.sql`r."unitId"`
      : dimension === 'category'
        ? Prisma.sql`r.category`
        : dimension === 'supplier'
          ? Prisma.sql`o."supplierId"::text`
          : Prisma.sql`o."currencyCode"`;
  const [counts, groups, performance, financeStatuses] = await Promise.all([
    tx.$queryRaw<{ status: string; count: number }[]>(
      Prisma.sql`SELECT r.status, COUNT(*)::int AS count FROM procurement_request r WHERE ${scope} GROUP BY r.status ORDER BY r.status LIMIT 30`,
    ),
    tx.$queryRaw<
      {
        label: string | null;
        currencyCode: string;
        cancelled: boolean;
        count: number;
        amount: string;
      }[]
    >(Prisma.sql`
      SELECT ${group} AS label, o."currencyCode", (o.status = 'CANCELLED') AS cancelled, COUNT(*)::int AS count, SUM(o."totalAmount")::text AS amount
      FROM procurement_order o JOIN procurement_request r ON r.id = o."requestId" WHERE ${scope}
      GROUP BY ${group}, o."currencyCode", (o.status = 'CANCELLED') ORDER BY label NULLS LAST, o."currencyCode", cancelled LIMIT 51 OFFSET ${(page - 1) * 50}`),
    tx.$queryRaw<
      {
        orders: number;
        lateOrders: number;
        discrepancyOrders: number;
        completedOrders: number;
        onTimeOrders: number;
        approvalSeconds: string | null;
        supplySeconds: string | null;
      }[]
    >(Prisma.sql`
      WITH scoped AS (SELECT r.* FROM procurement_request r WHERE ${scope}), delivery AS (
        SELECT o.id, o.status, o."expectedAt", o.data, r."createdAt", ${remainingOrder} AS remaining,
        GREATEST((SELECT MAX(g."receivedAt") FROM procurement_receipt g WHERE g."orderId" = o.id),
          (SELECT MAX(s."acceptedAt") FROM procurement_service_acceptance s WHERE s."orderId" = o.id)) AS completed_at,
        EXISTS (SELECT 1 FROM procurement_discrepancy d WHERE d."orderId" = o.id) AS discrepant
        FROM procurement_order o JOIN scoped r ON r.id = o."requestId" WHERE o.status IN ('ISSUED','CLOSED'))
      SELECT COUNT(*)::int AS orders,
        COUNT(*) FILTER (WHERE status = 'ISSUED' AND remaining AND "expectedAt" < CURRENT_TIMESTAMP)::int AS "lateOrders",
        COUNT(*) FILTER (WHERE discrepant)::int AS "discrepancyOrders",
        COUNT(*) FILTER (WHERE NOT remaining AND completed_at IS NOT NULL)::int AS "completedOrders",
        COUNT(*) FILTER (WHERE NOT remaining AND completed_at <= "expectedAt")::int AS "onTimeOrders",
        AVG(EXTRACT(EPOCH FROM ((data->>'issuedAt')::timestamptz - "createdAt")))::text AS "supplySeconds",
        (SELECT AVG(EXTRACT(EPOCH FROM (decided_at - a."createdAt")))::text FROM procurement_approval_snapshot a
          JOIN scoped r ON r.id = a."requestId"
          JOIN LATERAL (SELECT MAX(d."createdAt") AS decided_at FROM procurement_approval_step s JOIN procurement_approval_decision d ON d."stepId" = s.id WHERE s."snapshotId" = a.id) decision ON true
          WHERE NOT EXISTS (SELECT 1 FROM procurement_approval_step s WHERE s."snapshotId" = a.id AND s.status <> 'APPROVED')) AS "approvalSeconds"
      FROM delivery`),
    tx.$queryRaw<{ status: string; count: number; amount: string }[]>(
      Prisma.sql`SELECT h.status, COUNT(*)::int AS count, COALESCE(SUM(i."totalAmount"), 0)::text AS amount
        FROM procurement_finance_handoff h
        JOIN procurement_request r ON r.id = h."requestId"
        JOIN procurement_invoice i ON i.id = h."invoiceId"
        WHERE ${scope}
        GROUP BY h.status ORDER BY h.status`,
    ),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    counts,
    performance: performance[0],
    dimension,
    groups: {
      items: groups.slice(0, 50),
      page,
      pageSize: 50,
      hasMore: groups.length > 50,
    },
    basis: 'CURRENT_ORDER_VERSION_BY_CURRENCY',
    finance: 'CONNECTED' as const,
    financeStatuses,
  };
}
