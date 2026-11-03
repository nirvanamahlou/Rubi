import type { Prisma } from '@nora/database';

/** HR-owned read port. Caller must supply its authenticated branch/report scope.
 * Roster labels are current; this port never attributes historical calls.
 */
export async function callPerformanceStaff(
  tx: Prisma.TransactionClient,
  branchId: string,
  users: string[] | null,
) {
  const rows = await tx.hrEmployee.findMany({
    where: {
      branchId,
      status: 'فعال',
      deletedAt: null,
      userId: users === null ? { not: null } : { in: users },
    },
    select: {
      userId: true,
      name: true,
      records: {
        where: {
          branchId,
          section: 'employee',
          tab: 'internalContact',
          deletedAt: null,
        },
        select: { values: true },
      },
    },
    take: 1001,
  });
  if (rows.length > 1000) throw new Error('STAFF_REPORT_LIMIT');
  return rows.flatMap((row) =>
    row.userId
      ? [
          {
            id: row.userId,
            name: row.name,
            extensions: row.records.flatMap((r) =>
              Array.isArray(r.values)
                ? r.values.filter(
                    (v): v is string =>
                      typeof v === 'string' && /^\d{1,16}$/.test(v),
                  )
                : [],
            ),
          },
        ]
      : [],
  );
}
