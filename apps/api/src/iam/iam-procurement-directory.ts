import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedActor } from '@nora/contracts';
import { authenticatedPermissionCodes } from './authenticated-permissions';

/** Owner-only identity/authority check. Never exposes roles, contact PII or credentials. */
@Injectable()
export class IamProcurementDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}
  /** Revalidate a queued action against its still-active login, not saved role claims. */
  async actorForSession(
    userId: string,
    sessionId: string,
  ): Promise<AuthenticatedActor | null> {
    const session = await this.database.client.session.findFirst({
      where: {
        id: sessionId,
        userId,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() },
        user: { status: 'ACTIVE' },
      },
      include: {
        user: {
          include: {
            branches: { where: { branch: { isActive: true } } },
            roles: {
              include: {
                role: {
                  include: { permissions: { include: { permission: true } } },
                },
              },
            },
          },
        },
      },
    });
    return session
      ? {
          userId,
          sessionId,
          branchIds: session.user.branches.map((branch) => branch.branchId),
          permissions: authenticatedPermissionCodes(session.user.roles),
        }
      : null;
  }
  async candidates(branchId: string, search: string, page: number) {
    const rows = await this.database.client.user.findMany({
      where: {
        status: 'ACTIVE',
        branches: { some: { branchId, branch: { isActive: true } } },
        roles: {
          some: {
            role: {
              isActive: true,
              permissions: {
                some: { permission: { code: 'procurement.quote.manage' } },
              },
            },
          },
        },
        ...(search
          ? { displayName: { contains: search, mode: 'insensitive' as const } }
          : {}),
      },
      select: { id: true, displayName: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: 51,
      skip: (page - 1) * 50,
    });
    return {
      items: rows
        .slice(0, 50)
        .map((row) => ({ id: row.id, label: row.displayName })),
      page,
      pageSize: 50,
      hasMore: rows.length > 50,
    };
  }
  async authorizedUsers(ids: string[], branchId: string, permission: string) {
    if (
      ids.length === 0 ||
      ids.length > 100 ||
      !permission.startsWith('procurement.')
    )
      return [];
    return this.database.client.user.findMany({
      where: {
        id: { in: ids },
        status: 'ACTIVE',
        branches: { some: { branchId, branch: { isActive: true } } },
        roles: {
          some: {
            role: {
              isActive: true,
              permissions: { some: { permission: { code: permission } } },
            },
          },
        },
      },
      select: { id: true },
      take: 100,
    });
  }
}
