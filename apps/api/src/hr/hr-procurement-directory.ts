import { Inject, Injectable } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import { DatabaseService } from '../database/database.service';

/** Minimal public employee projection for Procurement own/unit scope. */
@Injectable()
export class HrProcurementDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async self(actor: AuthenticatedActor, branchId?: string) {
    return this.activeEmployee(actor, actor.userId, branchId);
  }
  /** Called only after Procurement has authorized the request aggregate. */
  async requester(actor: AuthenticatedActor, userId: string, branchId: string) {
    if (
      !actor.permissions.some((permission) =>
        ['procurement.request.update', 'procurement.request.submit'].includes(
          permission,
        ),
      )
    )
      return null;
    return this.activeEmployee(actor, userId, branchId);
  }
  private async activeEmployee(
    actor: AuthenticatedActor,
    userId: string,
    branchId?: string,
  ) {
    if (branchId && !actor.branchIds.includes(branchId)) return null;
    const row = await this.database.client.hrEmployee.findFirst({
      where: {
        userId,
        branchId: { in: branchId ? [branchId] : actor.branchIds },
        status: 'فعال',
        deletedAt: null,
      },
      select: {
        id: true,
        userId: true,
        branchId: true,
        name: true,
        unit: true,
        version: true,
      },
    });
    return row
      ? {
          id: row.id,
          version: row.version,
          userId: row.userId,
          branchId: row.branchId,
          label: row.name,
          unitId: row.unit || null,
        }
      : null;
  }
}
