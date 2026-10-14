import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { authenticatedPermissionCodes } from './authenticated-permissions';

/** Public IAM projection for branch-scoped Reservations notifications and audit names. */
@Injectable()
export class IamReservationsDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async recipients(branchId: string, tx: Prisma.TransactionClient) {
    const users = await tx.user.findMany({
      where: {
        status: 'ACTIVE',
        branches: { some: { branchId, branch: { isActive: true } } },
      },
      select: {
        id: true,
        roles: {
          select: {
            role: {
              select: {
                isActive: true,
                code: true,
                name: true,
                permissions: {
                  select: { permission: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });
    return users
      .filter((user) =>
        authenticatedPermissionCodes(user.roles).includes('reservations.read'),
      )
      .map((user) => user.id);
  }
  async names(ids: readonly string[]) {
    const users = await this.database.client.user.findMany({
      where: { id: { in: [...new Set(ids)] } },
      select: { id: true, displayName: true },
    });
    return new Map(users.map((user) => [user.id, user.displayName]));
  }
}
