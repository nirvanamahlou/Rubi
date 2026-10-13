import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedActor } from '@nora/contracts';
import { authenticatedPermissionCodes } from './authenticated-permissions';

/** IAM-owned public identity projection for Finance; no credentials or HR details. */
@Injectable()
export class IamFinanceDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  branches(branchIds: string[]) {
    return this.database.client.branch.findMany({
      where: { id: { in: branchIds }, isActive: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
  }
  displayNames(userIds: string[], branchIds: string[]) {
    return this.database.client.user.findMany({
      where: {
        id: { in: [...new Set(userIds)] },
        branches: { some: { branchId: { in: branchIds } } },
      },
      select: { id: true, displayName: true },
    });
  }
  candidates(branchId: string) {
    return this.database.client.user.findMany({
      where: {
        status: 'ACTIVE',
        branches: { some: { branchId, branch: { isActive: true } } },
        roles: {
          some: {
            role: {
              isActive: true,
              permissions: { some: { permission: { code: 'finance.read' } } },
            },
          },
        },
      },
      select: { id: true, displayName: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: 2000,
    });
  }
  async eligible(userId: string, branchId: string) {
    return Boolean(
      await this.database.client.user.findFirst({
        where: {
          id: userId,
          status: 'ACTIVE',
          branches: { some: { branchId, branch: { isActive: true } } },
          roles: {
            some: {
              role: {
                isActive: true,
                permissions: { some: { permission: { code: 'finance.read' } } },
              },
            },
          },
        },
        select: { id: true },
      }),
    );
  }
  /** Configured background observer, revalidated from live IAM; never a login session. */
  async reminderPrincipal(
    userId: string,
    branchId: string,
  ): Promise<AuthenticatedActor | null> {
    const user = await this.database.client.user.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
        branches: { some: { branchId, branch: { isActive: true } } },
      },
      select: {
        roles: {
          select: {
            role: {
              select: {
                isActive: true,
                permissions: {
                  select: { permission: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!user) return null;
    const permissions = authenticatedPermissionCodes(user.roles);
    return permissions.includes('finance.read')
      ? {
          userId,
          sessionId: 'system:finance-deadline-observer',
          branchIds: [branchId],
          permissions,
        }
      : null;
  }
}
