import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@nora/contracts';
import { HrUserUnitDirectory } from '../hr/hr-user-unit-directory';
import type { Prisma } from '@nora/database';
import { DatabaseService } from '../database/database.service';
import { authenticatedPermissionCodes } from './authenticated-permissions';
import { canViewRoute, hasScopedCallCenterAccess } from '@nora/contracts';
import { CALL_CENTER_SALES_MANAGER } from '@nora/contracts';
import {
  answeredCallAccess,
  globalCallCenterIds,
  callCenterScopedActor,
} from './call-center-answer-policy';

/** Public, branch-scoped directory. Does not expose roles or personnel data. */
@Injectable()
export class IamCallCenterDirectory {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(HrUserUnitDirectory)
    private readonly personnel: HrUserUnitDirectory = new HrUserUnitDirectory(
      database,
    ),
  ) {}

  async globalCallCenter(
    actor: AuthenticatedActor,
    tx?: Prisma.TransactionClient,
  ) {
    if (!answeredCallAccess() || !globalCallCenterIds().includes(actor.userId))
      return false;
    return !!(await (tx ?? this.database.client).user.findFirst({
      where: { id: actor.userId, status: 'ACTIVE', b2bOrganizationUser: null },
      select: { id: true },
    }));
  }

  async callCenterActor(actor: AuthenticatedActor) {
    if (!(await this.globalCallCenter(actor))) return actor;
    const branches = await this.database.client.branch.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    return callCenterScopedActor(actor, {
      ...actor,
      branchIds: branches.map((branch) => branch.id),
      permissions: [
        ...new Set([
          ...actor.permissions,
          ...CALL_CENTER_SALES_MANAGER,
          'customer_affairs.call_center.recordings.read' as const,
        ]),
      ],
    });
  }

  async answeredAccounts(
    branchId: string,
    extension: string,
    at: string,
    tx: Prisma.TransactionClient,
  ) {
    const ids = await this.personnel.callCenterAnswerAccounts(
      branchId,
      extension,
      new Date(at),
      tx,
    );
    if (!ids.length) return [];
    const users = await tx.user.findMany({
      where: {
        id: { in: ids },
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        branches: { some: { branchId, branch: { isActive: true } } },
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
  }

  /** Management fields follow the current assignee's unit, or creator for unassigned requests. */
  async canManageRequest(
    actor: AuthenticatedActor,
    branchId: string,
    responsibleUserId: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    if (
      !actor.branchIds.includes(branchId) ||
      !actor.permissions.includes(
        'customer_affairs.call_center.workflow.manage',
      )
    )
      return false;
    if (await this.globalCallCenter(actor, tx)) return true;
    const client = tx ?? this.database.client;
    if (tx) {
      await tx.$queryRaw`SELECT id FROM iam_users WHERE id IN (${actor.userId}::uuid, ${responsibleUserId ?? actor.userId}::uuid) ORDER BY id FOR SHARE`;
      await tx.$queryRaw`SELECT user_id FROM iam_user_profiles WHERE user_id IN (${actor.userId}::uuid, ${responsibleUserId ?? actor.userId}::uuid) ORDER BY user_id FOR SHARE`;
    }
    const account = await client.user.findFirst({
      where: {
        id: actor.userId,
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        branches: { some: { branchId, branch: { isActive: true } } },
      },
      select: {
        username: true,
        profile: { select: { organizationUnitId: true } },
      },
    });
    if (!account) return false;
    if (
      !answeredCallAccess() &&
      (process.env.CALL_CENTER_REQUEST_GLOBAL_USERNAMES ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .includes(account.username)
    )
      return true;
    if (
      !actor.permissions.includes(
        'customer_affairs.call_center.workflow.manage.team',
      ) ||
      !account.profile?.organizationUnitId ||
      !responsibleUserId
    )
      return false;
    if (
      !(await this.personnel.callCenterUnit(
        branchId,
        account.profile.organizationUnitId,
        tx,
      ))
    )
      return false;
    const target = await client.user.findFirst({
      where: { id: responsibleUserId, branches: { some: { branchId } } },
      select: { profile: { select: { organizationUnitId: true } } },
    });
    return (
      target?.profile?.organizationUnitId === account.profile.organizationUnitId
    );
  }

  /** Request execution ownership is independent of telephony recipient eligibility. */
  async requestAssignees(
    actor: AuthenticatedActor,
    branchId: string,
    tx?: Prisma.TransactionClient,
  ) {
    if (
      !actor.branchIds.includes(branchId) ||
      !actor.permissions.includes(
        'customer_affairs.call_center.workflow.manage',
      ) ||
      !actor.permissions.includes('customer_affairs.call_center.read') ||
      !canViewRoute(actor.permissions, '/customer-affairs/call-center')
    )
      throw new ForbiddenException();
    const client = tx ?? this.database.client;
    const approvedGlobal = await this.globalCallCenter(actor, tx);
    const account = await client.user.findFirst({
      where: {
        id: actor.userId,
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        ...(!approvedGlobal
          ? { branches: { some: { branchId, branch: { isActive: true } } } }
          : {}),
      },
      select: {
        username: true,
        profile: {
          select: {
            organizationUnitId: true,
          },
        },
      },
    });
    if (!account) throw new ForbiddenException();
    const global =
      approvedGlobal ||
      (!answeredCallAccess() &&
        new Set(
          (process.env.CALL_CENTER_REQUEST_GLOBAL_USERNAMES ?? '')
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        ).has(account.username));
    const unitId = account.profile?.organizationUnitId;
    const team =
      actor.permissions.includes(
        'customer_affairs.call_center.workflow.manage.team',
      ) &&
      unitId &&
      (await this.personnel.callCenterUnit(branchId, unitId, tx))
        ? unitId
        : null;
    const users = await client.user.findMany({
      where: {
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        branches: { some: { branchId, branch: { isActive: true } } },
        ...(!global
          ? team
            ? { profile: { organizationUnitId: team } }
            : { id: actor.userId }
          : {}),
      },
      select: { id: true, displayName: true },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });
    const staff = await this.personnel.callCenterStaff(
      branchId,
      users.map((user) => user.id),
      tx,
    );
    const names = new Map(staff.map((person) => [person.userId, person]));
    return users.map((user) => ({
      id: user.id,
      displayName: names.get(user.id)?.name || user.displayName,
      ...(global
        ? { position: names.get(user.id)?.position || null, showPosition: true }
        : {}),
    }));
  }

  async resolveRequestAssignee(
    tx: Prisma.TransactionClient,
    actor: AuthenticatedActor,
    branchId: string,
    id: string,
  ) {
    // Serialize assignment with account activation and organization edits.
    await tx.$queryRaw`SELECT id FROM iam_users WHERE id IN (${actor.userId}::uuid, ${id}::uuid) ORDER BY id FOR SHARE`;
    await tx.$queryRaw`SELECT user_id FROM iam_user_profiles WHERE user_id IN (${actor.userId}::uuid, ${id}::uuid) ORDER BY user_id FOR SHARE`;
    await tx.$queryRaw`SELECT "userId" FROM iam_user_branches WHERE "userId" IN (${actor.userId}::uuid, ${id}::uuid) AND "branchId"=${branchId}::uuid ORDER BY "userId" FOR SHARE`;
    const user = (await this.requestAssignees(actor, branchId, tx)).find(
      (item) => item.id === id,
    );
    if (!user)
      throw new ForbiddenException(
        'کارشناس انتخاب‌شده خارج از محدوده مجاز ارجاع درخواست است.',
      );
    return user;
  }
  private async rows(branchId: string, tx?: Prisma.TransactionClient) {
    return (tx ?? this.database.client).user.findMany({
      where: {
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        branches: { some: { branchId, branch: { isActive: true } } },
      },
      include: {
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
    });
  }
  async list(branchId: string, tx?: Prisma.TransactionClient) {
    return (await this.rows(branchId, tx))
      .filter((user) => {
        const permissions = authenticatedPermissionCodes(user.roles);
        return (
          (!hasScopedCallCenterAccess(permissions) ||
            canViewRoute(permissions, '/customer-affairs/call-center')) &&
          permissions.includes('customer_affairs.call_center.read') &&
          permissions.includes('customer_affairs.call_center.workflow.manage')
        );
      })
      .map(({ id, displayName }) => ({ id, displayName }));
  }
  async eligibleMapping(
    branchId: string,
    userId: string,
    teamId: string | null,
    tx?: Prisma.TransactionClient,
  ) {
    if (!(await this.list(branchId, tx)).some((user) => user.id === userId))
      return false;
    if (!teamId) return true;
    return !!(await (tx ?? this.database.client).user.findFirst({
      where: { id: userId, profile: { organizationUnitId: teamId } },
      select: { id: true },
    }));
  }
  /** Public IAM check used immediately before a queued PBX side effect. */
  async canOriginate(branchId: string, userId: string) {
    const user = (await this.rows(branchId)).find((row) => row.id === userId);
    if (!user) return false;
    const permissions = authenticatedPermissionCodes(user.roles);
    return (
      (!hasScopedCallCenterAccess(permissions) ||
        (permissions.includes('customer_affairs.call_center.outbound.own') &&
          canViewRoute(permissions, '/customer-affairs/call-center'))) &&
      (
        [
          'customer_affairs.call_center.read',
          'customer_affairs.call_center.workflow.manage',
          'customer_affairs.call_center.calls.create',
        ] as const
      ).every((code) => permissions.includes(code))
    );
  }
  async referral(
    tx: Prisma.TransactionClient,
    branchId: string,
    id: string,
    destination: 'SALES' | 'SUPPORT',
  ) {
    await this.resolve(tx, branchId, id);
    const row = (await this.rows(branchId, tx)).find((user) => user.id === id);
    const permissions = row ? authenticatedPermissionCodes(row.roles) : [];
    const allowed =
      destination === 'SALES'
        ? permissions.some((p) => p.startsWith('sales.contracts.read.'))
        : permissions.includes('customer_affairs.ticket.read');
    if (!allowed)
      throw new BadRequestException('گیرنده مجوز ماژول مقصد را ندارد.');
  }
  async resolve(tx: Prisma.TransactionClient, branchId: string, id: string) {
    await tx.$queryRaw`SELECT id FROM iam_users WHERE id = ${id}::uuid FOR SHARE`;
    await tx.$queryRaw`SELECT "userId" FROM iam_user_branches WHERE "userId" = ${id}::uuid AND "branchId" = ${branchId}::uuid FOR SHARE`;
    const user = (await this.list(branchId, tx)).find((row) => row.id === id);
    if (!user)
      throw new BadRequestException(
        'کارشناس فعال و مجاز این شعبه را انتخاب کنید.',
      );
    return user;
  }
  /** Explicit deployment configuration; never infer sales managers from request authors. */
  async closureRecipients(tx: Prisma.TransactionClient, branchId: string) {
    const ids = new Set(
      (process.env.CALL_CENTER_CLOSURE_MANAGER_IDS ?? '')
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean),
    );
    if (!ids.size) return [];
    return (await this.list(branchId, tx)).filter((user) => ids.has(user.id));
  }
}
