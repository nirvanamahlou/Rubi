import { Prisma } from '@nora/database';
/** Tasks-owned query contract, request alias r supplied by Customer Affairs. */
export function callCenterTaskFilter(
  branchId: string,
  state: string | undefined,
  now: Date,
  day: Date,
) {
  if (!state) return Prisma.sql`TRUE`;
  const status = ['TODAY', 'OVERDUE'].includes(state) ? 'OPEN' : state;
  const due =
    state === 'TODAY'
      ? Prisma.sql`AND t."dueAt" >= ${day} AND t."dueAt" < ${new Date(day.getTime() + 86400000)}`
      : state === 'OVERDUE'
        ? Prisma.sql`AND t."dueAt" < ${now}`
        : Prisma.empty;
  return Prisma.sql`EXISTS(SELECT 1 FROM automation_tasks t
    WHERE t."sourceModule"='CALL_CENTER' AND t."branchId"=${branchId}::uuid AND t.call_center_ticket_id=r.id AND t.status=${status} ${due})`;
}
export async function callCenterTaskReport(
  tx: Prisma.TransactionClient,
  branchId: string,
  from: Date,
  to: Date,
  now: Date,
  day: Date,
) {
  const rows = await tx.$queryRaw<
    Array<{
      open: bigint;
      today: bigint;
      overdue: bigint;
      completed: bigint;
      onTime: bigint;
    }>
  >`
    SELECT count(*) FILTER(WHERE status='OPEN') AS open,
    count(*) FILTER(WHERE status='OPEN' AND "dueAt" >= ${day} AND "dueAt" < ${new Date(day.getTime() + 86400000)}) AS today,
    count(*) FILTER(WHERE status='OPEN' AND "dueAt" < ${now}) AS overdue,
    count(*) FILTER(WHERE status='COMPLETED' AND "completedAt" >= ${from} AND "completedAt" < ${to}) AS completed,
    count(*) FILTER(WHERE status='COMPLETED' AND "completedAt" >= ${from} AND "completedAt" < ${to} AND "completedAt" <= "dueAt") AS "onTime"
    FROM automation_tasks WHERE "sourceModule"='CALL_CENTER' AND "branchId"=${branchId}::uuid`;
  const activity = await tx.$queryRaw<
    Array<{ actorId: string | null; role: string; count: bigint }>
  >`SELECT "assigneeUserId"::text AS "actorId",'CURRENT_OWNER' AS role,count(*) AS count FROM automation_tasks
    WHERE "sourceModule"='CALL_CENTER' AND "branchId"=${branchId}::uuid AND status='OPEN' GROUP BY "assigneeUserId"
    UNION ALL
    SELECT payload->'history'->-1->>'actorId' AS "actorId",'COMPLETED_BY' AS role,count(*) AS count FROM automation_tasks
    WHERE "sourceModule"='CALL_CENTER' AND "branchId"=${branchId}::uuid AND status='COMPLETED' AND "completedAt">=${from} AND "completedAt"<${to}
    GROUP BY payload->'history'->-1->>'actorId'`;
  const row = rows[0]!;
  return {
    activity: activity.map((a) => ({ ...a, count: Number(a.count) })),
    open: Number(row.open),
    today: Number(row.today),
    overdue: Number(row.overdue),
    completed: Number(row.completed),
    onTime: Number(row.onTime),
  };
}
export async function callCenterTaskRevision(
  tx: Prisma.TransactionClient,
  branchId: string,
) {
  const result = await tx.automationTask.aggregate({
    where: { branchId, sourceModule: 'CALL_CENTER' },
    _count: true,
    _max: { updatedAt: true },
  });
  const overdue = await tx.automationTask.count({
    where: {
      branchId,
      sourceModule: 'CALL_CENTER',
      status: 'OPEN',
      dueAt: { lt: new Date() },
    },
  });
  return [result._count, result._max.updatedAt?.toISOString() ?? '', overdue];
}
