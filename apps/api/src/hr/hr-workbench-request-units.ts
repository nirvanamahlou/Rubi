import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';

/** Minimal public HR projection for internal request routing, without personnel data. */
@Injectable()
export class HrWorkbenchRequestUnits {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  /** Self-only routing context. Account links, not names or login branch order. */
  async employeeBranches(userId: string, branchIds: readonly string[]) {
    const rows = await this.database.client.hrEmployee.findMany({
      where: {
        userId,
        branchId: { in: [...branchIds] },
        status: 'فعال',
        deletedAt: null,
      },
      select: { branchId: true },
      distinct: ['branchId'],
    });
    return rows.map((row) => row.branchId);
  }

  async list(branchId: string, tx?: Prisma.TransactionClient) {
    const rows = await (tx ?? this.database.client).hrRecord.findMany({
      where: {
        branchId,
        section: 'organization',
        tab: 'units',
        status: 'فعال',
        deletedAt: null,
      },
      select: { id: true, values: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
    return rows.flatMap((row) => {
      const name = Array.isArray(row.values) ? row.values[0] : null;
      return typeof name === 'string' && name.trim()
        ? [{ id: row.id, name: name.trim() }]
        : [];
    });
  }

  /** HR employee membership supplements IAM profile membership for requests only. */

  async members(branchId: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.database.client).hrEmployee.findMany({
      where: {
        branchId,
        status: 'فعال',
        deletedAt: null,
        userId: { not: null },
      },

      select: { userId: true, unit: true },
    });
  }

  async lockEmployee(
    tx: Prisma.TransactionClient,
    userId: string,
    branchId: string,
  ) {
    await tx.$queryRaw`SELECT id FROM hr_employees WHERE user_id=${userId}::uuid AND branch_id=${branchId}::uuid FOR SHARE`;
  }
  async lock(tx: Prisma.TransactionClient, unitId: string) {
    await tx.$queryRaw`SELECT id FROM hr_records WHERE id = ${unitId}::uuid FOR SHARE`;
  }
}
