import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';

/** Minimal public HR projection for internal request routing, without personnel data. */
@Injectable()
export class HrWorkbenchRequestUnits {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

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

  async lock(tx: Prisma.TransactionClient, unitId: string) {
    await tx.$queryRaw`SELECT id FROM hr_records WHERE id = ${unitId}::uuid FOR SHARE`;
  }
}
