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
  extraRequestAssignees,
  extraRequestPolicy,
} from './call-request-extra-assignees';
import { hrCallRoutes, hrCallRoutingEnabled } from './hr-call-routing';
import {
  answeredCallAccess,
  globalCallCenterIds,
  callCenterScopedActor,
} from './call-center-answer-policy';

/** Public, branch-scoped directory. Does not expose roles or personnel data. */
@Injectable()
export class IamCallCenterDirectory {
  private async eligibleExtraAssignees(
    actor: AuthenticatedActor,
    branchId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const policy = extraRequestPolicy(actor.userId);
    if (!policy) return [];
    return (await this.personnel.callCenterRequestTeam(
      branchId,
      actor.userId,
      tx,
      policy.unitId,
    ))
      ? policy.userIds
      : [];
  }
  async employeeCallRoutes(branchId: string, tx?: Prisma.TransactionClient) {
    return hrCallRoutes(this.database, branchId, tx);
  }
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

  /** Single pinned executive account; global/demo/role grants cannot authorize audio. */
  async canDownloadCallRecordings(
    actor: AuthenticatedActor,
    tx?: Prisma.TransactionClient,
  ) {
    const id = process.env.CALL_CENTER_RECORDING_DOWNLOAD_USER_ID?.trim();
    if (
      !id ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        id,
      ) ||
      actor.userId !== id
    )
      return false;
    return !!(await (tx ?? this.database.client).user.findFirst({
      where: {
        id,
        username: 'danial',
        status: 'ACTIVE',
        b2bOrganizationUser: null,
      },
      select: { id: true },
    }));
  }

  async callCenterActor(actor: AuthenticatedActor) {
    const audio = 'customer_affairs.call_center.recordings.read' as const;
    const permitted = await this.canDownloadCallRecordings(actor);
    const permissions: AuthenticatedActor['permissions'][number][] =
      actor.permissions.filter((code) => code !== audio);
    if (
      permitted &&
      actor.permissions.includes('customer_affairs.call_center.read')
    )
      permissions.push(audio);
    if (
      permissions.length !== actor.permissions.length ||
      permissions.some((code, index) => code !== actor.permissions[index])
    )
      actor = callCenterScopedActor(actor, { ...actor, permissions });
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
          ...(permitted ? [audio] : []),
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
    if (
      hrCallRoutingEnabled() &&
      Math.abs(Date.now() - Date.parse(at)) <= 60000
    )
      return (
        (await this.employeeCallRoutes(branchId, tx)).find(
          (r) => r.extension === extension,
        )?.userIds ?? []
      );
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
      responsibleUserId &&
      actor.permissions.includes('customer_affairs.call_center.read') &&
      canViewRoute(actor.permissions, '/customer-affairs/call-center') &&
      (await this.eligibleExtraAssignees(actor, branchId, tx)).includes(
        responsibleUserId,
      ) &&
      (await client.user.findFirst({
        where: {
          id: responsibleUserId,
          status: 'ACTIVE',
          b2bOrganizationUser: null,
          branches: { some: { branchId, branch: { isActive: true } } },
        },
        select: { id: true },
      }))
    )
      return true;
    if (
      !answeredCallAccess() &&
      (process.env.CALL_CENTER_REQUEST_GLOBAL_USERNAMES ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .includes(account.username)
    )
      return true;
    if (!responsibleUserId) return false;
    const team = await this.personnel.callCenterRequestTeam(
      branchId,
      actor.userId,
      tx,
    );
    if (!team?.includes(responsibleUserId)) return false;
    return !!(await client.user.findFirst({
      where: {
        id: responsibleUserId,
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        branches: { some: { branchId, branch: { isActive: true } } },
      },
      select: { id: true },
    }));
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
    // Callback triage and broad Call Center read grants do not authorize
    // cross-department assignment. Only the verified executive account does.
    const global =
      account.username === 'danial' &&
      (approvedGlobal ||
        (!answeredCallAccess() &&
          new Set(
            (process.env.CALL_CENTER_REQUEST_GLOBAL_USERNAMES ?? '')
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean),
          ).has(account.username)));
    const team = global
      ? null
      : await this.personnel.callCenterRequestTeam(branchId, actor.userId, tx);
    const extra = team
      ? await this.eligibleExtraAssignees(actor, branchId, tx)
      : [];
    const users = await client.user.findMany({
      where: {
        status: 'ACTIVE',
        b2bOrganizationUser: null,
        branches: { some: { branchId, branch: { isActive: true } } },
        ...(!global
          ? team
            ? { id: { in: [...new Set([...team, ...extra])] } }
            : extra.length
              ? { id: { in: [actor.userId, ...extra] } }
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

  async additionalRequestAssigneeIds(
    actor: AuthenticatedActor,
    branchId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const extra = extraRequestAssignees(actor.userId);
    if (!extra.length) return [];
    return (await this.requestAssignees(actor, branchId, tx))
      .filter((user) => extra.includes(user.id))
      .map((user) => user.id);
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
    const linked = new Set(
      (await this.employeeCallRoutes(branchId, tx)).flatMap((r) => r.userIds),
    );
    return (await this.rows(branchId, tx))
      .filter((user) => {
        if (hrCallRoutingEnabled() && linked.has(user.id)) return true;
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
  /** Public IAM projection of request registrants in authorized branches. */
  async registrants(branchIds: readonly string[], teamId: string) {
    const users = await this.database.client.user.findMany({
      where: {
        branches: { some: { branchId: { in: [...branchIds] } } },
        profile: { organizationUnitId: teamId },
      },
      select: { id: true },
    });
    return users.map((user) => user.id);
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
