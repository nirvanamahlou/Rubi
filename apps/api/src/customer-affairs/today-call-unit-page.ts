import type { Prisma } from '@nora/database';
import type { CallCenterService } from './call-center.service';
import { matchesContactColumns } from './contact-column-filters';

type Summary = ReturnType<CallCenterService['presentSummary']>;

/** Filter the displayed destination before counting/paging, not its historical index. */
export async function todayCallUnitPage(
  tx: Prisma.TransactionClient,
  predicate: Prisma.Sql,
  query: { page: number; pageSize: number; unit: string },
  present: (
    rows: Awaited<
      ReturnType<Prisma.TransactionClient['callCenterCall']['findMany']>
    >,
  ) => Promise<Summary[]>,
) {
  const data: { call: Summary; callCount: number }[] = [];
  let total = 0;
  for (let offset = 0; ; offset += 200) {
    const rows = await tx.$queryRaw<{ id: string; callCount: bigint }[]>`
      SELECT a.id,
      (SELECT count(*) FROM customer_affairs_calls z WHERE z.contact_id=c.id) AS "callCount"
      FROM customer_affairs_calls a JOIN customer_affairs_call_contacts c ON c.id=a.contact_id
      WHERE ${predicate}
      ORDER BY a.occurred_at DESC,a.id ASC LIMIT 200 OFFSET ${offset}`;
    const calls = await tx.callCenterCall.findMany({
      where: { id: { in: rows.map((row) => row.id) } },
    });
    const indexed = new Map(
      (await present(calls)).map((call) => [call.id, call]),
    );
    for (const row of rows) {
      const call = indexed.get(row.id);
      if (!call || !matchesContactColumns(call, { unit: query.unit })) continue;
      if (
        total >= (query.page - 1) * query.pageSize &&
        data.length < query.pageSize
      )
        data.push({ call, callCount: Number(row.callCount) });
      total++;
    }
    if (rows.length < 200) break;
  }
  return { data, total };
}
