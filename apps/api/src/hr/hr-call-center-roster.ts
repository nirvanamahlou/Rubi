import type { Prisma } from '@nora/database';
import type { DatabaseService } from '../database/database.service';

/** HR-owned current routing facts. Account links are stored FKs, never names. */
export class HrCallCenterRoster {
  constructor(private readonly db: DatabaseService) {}
  async list(branchId: string, tx?: Prisma.TransactionClient) {
    const employees = await (tx ?? this.db.client).hrEmployee.findMany({
      where: {
        branchId,
        status: 'فعال',
        deletedAt: null,
        userId: { not: null },
      },
      select: {
        userId: true,
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
    });
    const routes = new Map<string, Set<string>>();
    for (const employee of employees)
      for (const record of employee.records) {
        if (!employee.userId || !Array.isArray(record.values)) continue;
        for (const value of record.values) {
          if (typeof value !== 'string') continue;
          const extension = value
            .trim()
            .replace(/[۰-۹]/g, (n) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(n)))
            .replace(/[٠-٩]/g, (n) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(n)));
          if (!/^\d{2,10}$/.test(extension)) continue;
          if (!routes.has(extension)) routes.set(extension, new Set());
          routes.get(extension)!.add(employee.userId);
        }
      }
    return [...routes].map(([extension, users]) => ({
      extension,
      userIds: [...users],
    }));
  }
}
