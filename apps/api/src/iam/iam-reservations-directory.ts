import { Inject, Injectable } from '@nestjs/common';
import { MANUAL_ACCESS_ROLE_PREFIX } from '@nora/contracts';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { authenticatedPermissionCodes } from './authenticated-permissions';

/** Public IAM projection for branch-scoped Reservations notifications and audit names. */
@Injectable()
export class IamReservationsDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  async canCorrectContractPrice(userId: string) {
    const user = await this.database.client.user.findUnique({
      where: { id: userId },
      select: {
        status: true,
        roles: {
          select: {
            role: { select: { isActive: true, code: true, name: true } },
          },
        },
      },
    });
    if (!user || user.status !== 'ACTIVE') return false;
    const manual = user.roles.filter(({ role }) =>
      role.code.startsWith(MANUAL_ACCESS_ROLE_PREFIX),
    );
    if (manual.length > 1) return false;
    const roles = manual.length ? manual : user.roles;
    return roles.some(
      ({ role }) =>
        role.isActive &&
        ([
          'administrator',
          'finance_staff',
          'finance_manager',
          'sales_manager',
          'sales-manager',
        ].includes(role.code) ||
          [
            'مدیر',
            'مدیر سامانه',
            'مدیر فروش',
            'مدیر مالی',
            'کارشناس مالی',
          ].includes(role.name)),
    );
  }
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
