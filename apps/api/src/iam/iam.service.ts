import { isOptionalOperationReason } from '@nora/contracts';
import { HrUserUnitDirectory } from '../hr/hr-user-unit-directory';
import type { Prisma } from '@nora/database';
import { userDetailsRevision } from './user-details';
import type { UpdateUserDetailsDto } from './dto/update-user-details.dto';
import { roleOptionSelection } from './role-access-option';
import { reusableRoleWhere } from './role-directory';
import {
  isPrivateUserRole,
  roleDirectoryRevision,
  ROLE_TEMPLATE_PREFIX,
} from './role-directory';
import {
  USER_JOB_TITLES,
  USER_ACCESS_SCREENS,
  USER_ACCESS_PROFILE_PERMISSION,
  screenPermission,
  hasManagedAccess,
  canViewScreen,
  canViewRoute,
  denyPermission,
  isUserAccessControlId,
  USER_ACCESS_DENY_CONTROLS,
  canUseMasterDataResource,
  hasAccessControl,
  IAM_PERMISSION_CODES,
  MANUAL_ACCESS_ROLE_PREFIX,
  CALL_CENTER_SCOPED_ACCESS,
  hasScopedCallCenterAccess,
  mustScopeCallCenter,
  completeManualAccessPrerequisites,
} from '@nora/contracts';
import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Optional,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthenticatedActor,
  IamPersonalProfileUpdateInputV1,
  IamPermissionCode,
  LoginResponse,
  MessagingContactV1,
} from '@nora/contracts';
import { AuditOutcome, SessionStatus, UserStatus } from '@nora/database';
import { hash, verify } from 'argon2';

import { DatabaseService } from '../database/database.service';
import {
  authenticatedPermissionCodes,
  salesManagerRolePermissions,
} from './authenticated-permissions';
import {
  ACCESS_TTL_SECONDS,
  LOCK_MINUTES,
  MAX_LOGIN_ATTEMPTS,
  REFRESH_TTL_DAYS,
} from './iam.constants';
import type { CreateUserDto } from './dto/create-user.dto';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateUserAccessDto } from './dto/update-user-access.dto';
import {
  assertStrongPassword,
  initialPasswordPolicyErrors,
  passwordPolicyErrors,
} from './password-policy';
import { classifyRefreshFailure } from './refresh-token-policy';
import type { RequestMetadata } from './iam.types';
import type { IamStepUpPort } from './iam-step-up.port';
import { MfaTotpService } from './mfa-totp';
import { changeIamPassword, lockIamUser } from './password-change';
import {
  persistManualSnapshot,
  manualUserInclude,
} from './manual-user-access.service';

interface AccessClaims {
  sub: string;
  sid: string;
  type: 'access';
}

const MFA_MAX_ATTEMPTS = 5;
const MFA_LOCK_MINUTES = 5;
const MFA_SETUP_TTL_MINUTES = 10;

@Injectable()
export class IamService implements IamStepUpPort {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(MfaTotpService) private readonly mfaTotp: MfaTotpService,
    @Optional()
    @Inject(HrUserUnitDirectory)
    private readonly units: HrUserUnitDirectory = new HrUserUnitDirectory(
      database,
    ),
  ) {}

  async login(
    usernameInput: string,
    password: string,
    metadata: RequestMetadata,
  ) {
    const username = usernameInput.trim().toLowerCase();
    const user = await this.database.client.user.findUnique({
      where: { username },
      include: this.userAccessInclude(),
    });
    const now = new Date();
    const locked = user?.lockedUntil && user.lockedUntil > now;
    const mayAuthenticate =
      user?.status === UserStatus.ACTIVE ||
      (user?.status === UserStatus.LOCKED && !locked);
    const valid =
      user && !locked && mayAuthenticate
        ? await verify(user.passwordHash, password).catch(() => false)
        : false;

    if (!user || !valid) {
      if (user && !locked && user.status !== UserStatus.INACTIVE) {
        await this.database.client.$transaction(async (transaction) => {
          await lockIamUser(transaction, user.id);
          const current = await transaction.user.findUnique({
            where: { id: user.id },
          });
          if (
            !current ||
            current.passwordHash !== user.passwordHash ||
            current.status === UserStatus.INACTIVE ||
            (current.lockedUntil && current.lockedUntil > new Date())
          )
            return;
          const failures = current.failedLoginAttempts + 1;
          await transaction.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: failures,
              lockedUntil:
                failures >= MAX_LOGIN_ATTEMPTS
                  ? new Date(Date.now() + LOCK_MINUTES * 60_000)
                  : null,
              status:
                failures >= MAX_LOGIN_ATTEMPTS
                  ? UserStatus.LOCKED
                  : current.status,
            },
          });
        });
      }
      await this.audit(
        null,
        'auth.login',
        'User',
        user?.id,
        AuditOutcome.FAILURE,
        metadata,
      );
      throw new UnauthorizedException('نام کاربری یا رمز عبور صحیح نیست.');
    }

    const sessionId = randomUUID();
    const familyId = randomUUID();
    const refreshSecret = randomBytes(48).toString('base64url');
    const expiresAt = new Date(now.getTime() + REFRESH_TTL_DAYS * 86_400_000);
    await this.database.client.$transaction(async (transaction) => {
      await lockIamUser(transaction, user.id);
      const current = await transaction.user.findUnique({
        where: { id: user.id },
      });
      if (
        !current ||
        current.passwordHash !== user.passwordHash ||
        current.status === UserStatus.INACTIVE ||
        (current.lockedUntil && current.lockedUntil > new Date())
      )
        throw new UnauthorizedException('نام کاربری یا رمز عبور صحیح نیست.');
      await transaction.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: UserStatus.ACTIVE,
          lastLoginAt: now,
        },
      });
      await transaction.session.create({
        data: {
          id: sessionId,
          familyId,
          userId: user.id,
          refreshTokenHash: this.tokenHash(refreshSecret),
          expiresAt,
          ...metadata,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: user.id,
          action: 'auth.login',
          entityType: 'Session',
          entityId: sessionId,
          outcome: AuditOutcome.SUCCESS,
          ...metadata,
        },
      });
    });
    return {
      accessToken: await this.issueAccessToken(user.id, sessionId),
      refreshToken: `${sessionId}.${refreshSecret}`,
      expiresAt,
      body: this.loginResponse(user),
    };
  }

  async refresh(rawToken: string | undefined, metadata: RequestMetadata) {
    const [sessionId, secret] = rawToken?.split('.', 2) ?? [];
    if (!sessionId || !secret)
      throw new UnauthorizedException('نشست معتبر نیست.');
    const session = await this.database.client.session.findUnique({
      where: { id: sessionId },
      include: { user: { include: this.userAccessInclude() } },
    });
    if (!session) throw new UnauthorizedException('نشست معتبر نیست.');
    const now = new Date();
    const supplied = Buffer.from(this.tokenHash(secret), 'hex');
    const stored = Buffer.from(session.refreshTokenHash, 'hex');
    const hashMatches =
      supplied.length === stored.length && timingSafeEqual(supplied, stored);
    if (session.status !== SessionStatus.ACTIVE || !hashMatches)
      await this.rejectRefresh(session, hashMatches, metadata, now);
    if (session.expiresAt <= now || session.user.status !== UserStatus.ACTIVE) {
      await this.revokeFamily(session.familyId, 'expired-or-disabled');
      throw new UnauthorizedException('نشست منقضی شده است.');
    }
    const nextId = randomUUID();
    const nextSecret = randomBytes(48).toString('base64url');
    const expiresAt = new Date(now.getTime() + REFRESH_TTL_DAYS * 86_400_000);
    const rotated = await this.database.client.$transaction(
      async (transaction) => {
        await lockIamUser(transaction, session.userId);
        const currentUser = await transaction.user.findUnique({
          where: { id: session.userId },
        });
        if (
          !currentUser ||
          currentUser.status !== UserStatus.ACTIVE ||
          currentUser.passwordHash !== session.user.passwordHash
        )
          throw new UnauthorizedException('نشست منقضی شده است.');
        const claimed = await transaction.session.updateMany({
          where: {
            id: session.id,
            status: SessionStatus.ACTIVE,
            refreshTokenHash: session.refreshTokenHash,
          },
          data: {
            status: SessionStatus.ROTATED,
            revokedAt: now,
            revokedReason: 'rotated',
            lastUsedAt: now,
          },
        });
        if (claimed.count !== 1) return false;
        await transaction.session.create({
          data: {
            id: nextId,
            familyId: session.familyId,
            userId: session.userId,
            refreshTokenHash: this.tokenHash(nextSecret),
            expiresAt,
            ...metadata,
          },
        });
        return true;
      },
    );
    if (!rotated) {
      const current = await this.database.client.session.findUnique({
        where: { id: session.id },
      });
      if (!current) throw new UnauthorizedException('نشست معتبر نیست.');
      await this.rejectRefresh(current, hashMatches, metadata, new Date());
    }
    return {
      accessToken: await this.issueAccessToken(session.userId, nextId),
      refreshToken: `${nextId}.${nextSecret}`,
      expiresAt,
      body: this.loginResponse(session.user),
    };
  }

  changePassword(
    actor: AuthenticatedActor,
    currentPassword: string,
    newPassword: string,
    metadata: RequestMetadata,
  ) {
    return changeIamPassword(
      this.database.client,
      actor,
      currentPassword,
      newPassword,
      metadata,
    );
  }

  async resetUserPassword(
    userId: string,
    newPassword: string,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ): Promise<void> {
    if (!actor.permissions.includes('iam.users.manage') || !actor.sessionId)
      throw new ForbiddenException(
        'تغییر رمز کاربران فقط برای مدیر سامانه مجاز است.',
      );
    if (!(await this.isSystemAdministrator(actor)))
      throw new ForbiddenException(
        'تغییر رمز کاربران فقط برای مدیر سامانه مجاز است.',
      );
    if (userId === actor.userId)
      throw new BadRequestException(
        'برای تغییر رمز خودتان از بخش تغییر رمز حساب استفاده کنید.',
      );
    const errors = passwordPolicyErrors(newPassword);
    if (errors.length || newPassword.length > 200)
      throw new BadRequestException({
        code: 'IAM_PASSWORD_POLICY',
        message: errors.join(' ') || 'رمز باید حداکثر ۲۰۰ نویسه باشد.',
      });
    const passwordHash = await hash(newPassword, {
      type: 2,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
    await this.database.client.$transaction(
      async (tx) => {
        // Stable user ordering also protects simultaneous administrator resets.
        for (const id of [actor.userId, userId].sort())
          await lockIamUser(tx, id);
        const administrator = await tx.user.findUnique({
          where: { id: actor.userId },
          select: {
            status: true,
            roles: {
              where: { role: { isActive: true } },
              select: { role: { select: { code: true } } },
            },
          },
        });
        const now = new Date();
        if (
          administrator?.status !== UserStatus.ACTIVE ||
          !administrator.roles.some(({ role }) => role.code === 'administrator')
        )
          throw new ForbiddenException(
            'تغییر رمز کاربران فقط برای مدیر سامانه مجاز است.',
          );
        const session = await tx.session.findFirst({
          where: {
            id: actor.sessionId,
            userId: actor.userId,
            status: SessionStatus.ACTIVE,
            expiresAt: { gt: now },
          },
        });
        if (!session) throw new UnauthorizedException();
        const target = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true },
        });
        if (!target) throw new NotFoundException('کاربر یافت نشد.');
        await tx.user.update({
          where: { id: userId },
          data: {
            passwordHash,
            passwordChangedAt: now,
            failedLoginAttempts: 0,
            lockedUntil: null,
          },
        });
        await tx.session.updateMany({
          where: {
            userId,
            status: { in: [SessionStatus.ACTIVE, SessionStatus.ROTATED] },
          },
          data: {
            status: SessionStatus.REVOKED,
            revokedAt: now,
            revokedReason: 'administrator-password-reset',
          },
        });
        await tx.auditEvent.create({
          data: {
            ...metadata,
            actorUserId: actor.userId,
            action: 'iam.user.password.reset',
            entityType: 'User',
            entityId: userId,
            outcome: AuditOutcome.SUCCESS,
          },
        });
      },
      { timeout: 10000 },
    );
  }

  async logout(
    sessionId: string | undefined,
    actorId: string | null,
    metadata: RequestMetadata,
  ): Promise<void> {
    if (sessionId) {
      await this.database.client.session.updateMany({
        where: { id: sessionId, status: SessionStatus.ACTIVE },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
          revokedReason: 'logout',
        },
      });
    }
    await this.audit(
      actorId,
      'auth.logout',
      'Session',
      sessionId,
      AuditOutcome.SUCCESS,
      metadata,
    );
  }

  async authenticate(accessToken: string): Promise<AuthenticatedActor> {
    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims>(accessToken);
    } catch {
      throw new UnauthorizedException('دسترسی معتبر نیست.');
    }
    if (claims.type !== 'access')
      throw new UnauthorizedException('دسترسی معتبر نیست.');
    return this.authenticateSessionReferenceV1(claims.sub, claims.sid);
  }

  /** Trusted protocol adapters only; never an unauthenticated browser endpoint. */
  async authenticateSessionReferenceV1(
    userId: string,
    sessionId: string,
    followRotation = false,
  ): Promise<AuthenticatedActor> {
    if (![userId, sessionId].every((value) => /^[0-9a-f-]{36}$/i.test(value)))
      throw new UnauthorizedException('دسترسی معتبر نیست.');
    const session = await this.database.client.session.findFirst({
      where: {
        id: sessionId,
        userId,
        status: followRotation
          ? { in: [SessionStatus.ACTIVE, SessionStatus.ROTATED] }
          : SessionStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      include: { user: { include: this.userAccessInclude() } },
    });
    if (!session || session.user.status !== UserStatus.ACTIVE)
      throw new UnauthorizedException('دسترسی معتبر نیست.');
    if (
      session.status === SessionStatus.ROTATED &&
      !(await this.database.client.session.findFirst({
        where: {
          familyId: session.familyId,
          userId,
          status: SessionStatus.ACTIVE,
          expiresAt: { gt: new Date() },
        },
        select: { id: true },
      }))
    )
      throw new UnauthorizedException('دسترسی معتبر نیست.');
    return {
      userId: session.userId,
      sessionId: session.id,
      permissions: this.permissionCodes(session.user),
      branchIds: session.user.branches.map(({ branchId }) => branchId),
    };
  }

  assertPermissions(
    actor: AuthenticatedActor,
    required: IamPermissionCode[],
  ): void {
    if (!required.every((code) => actor.permissions.includes(code))) {
      throw new ForbiddenException('مجوز لازم برای این عملیات وجود ندارد.');
    }
  }

  async listUsers() {
    const users = await this.database.client.user.findMany({
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        status: true,
        lastLoginAt: true,
        updatedAt: true,
        profile: { select: { organizationUnitId: true } },
        roles: {
          select: {
            role: {
              select: {
                id: true,
                code: true,
                name: true,
                isActive: true,
                permissions: {
                  select: { permission: { select: { id: true, code: true } } },
                },
              },
            },
          },
        },
        branches: {
          select: { branch: { select: { id: true, code: true, name: true } } },
        },
      },
    });
    return users.map((user) => ({
      ...user,
      accessRevision: this.accessRevision(user),
      detailsRevision: userDetailsRevision(user),
      organizationUnitId: user.profile?.organizationUnitId ?? null,
    }));
  }

  async listMessagingContacts(
    actor: AuthenticatedActor,
    requestedSearch?: string,
    requestedLimit = 50,
  ): Promise<{ contacts: MessagingContactV1[]; hasMore: boolean }> {
    const search = requestedSearch?.trim() ?? '';
    if (search.length > 100)
      throw new BadRequestException('عبارت جست‌وجو حداکثر ۱۰۰ نویسه است.');
    if (
      !Number.isInteger(requestedLimit) ||
      requestedLimit < 1 ||
      requestedLimit > 50
    )
      throw new BadRequestException('تعداد مخاطبان باید بین ۱ تا ۵۰ باشد.');
    const rows = await this.database.client.user.findMany({
      where: {
        id: { not: actor.userId },
        status: UserStatus.ACTIVE,
        b2bOrganizationUser: null,
        branches: {
          some: {
            branchId: { in: actor.branchIds },
            branch: { isActive: true },
          },
        },
        ...(search
          ? {
              OR: [
                {
                  displayName: {
                    contains: search,
                    mode: 'insensitive' as const,
                  },
                },
                {
                  username: { contains: search, mode: 'insensitive' as const },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        branches: {
          where: {
            branchId: { in: actor.branchIds },
            branch: { isActive: true },
          },
          select: { branch: { select: { id: true, code: true, name: true } } },
          orderBy: { branchId: 'asc' },
        },
      },
      orderBy: [{ displayName: 'asc' }, { id: 'asc' }],
      take: requestedLimit + 1,
    });
    return {
      contacts: rows.slice(0, requestedLimit).map((row) => ({
        id: row.id,
        displayName: row.displayName,
        username: row.username,
        branches: row.branches.map(({ branch }) => branch),
      })),
      hasMore: rows.length > requestedLimit,
    };
  }

  async validateMessagingRecipients(
    actor: AuthenticatedActor,
    requestedIds: string[],
  ): Promise<{ contacts: MessagingContactV1[]; branchId: string }> {
    const ids = [...new Set(requestedIds)];
    if (ids.length < 1 || ids.length > 50 || ids.includes(actor.userId))
      throw new BadRequestException('بین ۱ تا ۵۰ مخاطب معتبر انتخاب کنید.');
    const rows = await this.database.client.user.findMany({
      where: {
        id: { in: ids },
        status: UserStatus.ACTIVE,
        b2bOrganizationUser: null,
        branches: {
          some: {
            branchId: { in: actor.branchIds },
            branch: { isActive: true },
          },
        },
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        branches: {
          where: {
            branchId: { in: actor.branchIds },
            branch: { isActive: true },
          },
          select: { branch: { select: { id: true, code: true, name: true } } },
          orderBy: { branchId: 'asc' },
        },
      },
    });
    if (rows.length !== ids.length)
      throw new ForbiddenException(
        'یک یا چند مخاطب در محدوده مجاز پیام‌رسان نیستند.',
      );
    const branchId = [...actor.branchIds]
      .sort()
      .find((candidate) =>
        rows.every((row) =>
          row.branches.some(({ branch }) => branch.id === candidate),
        ),
      );
    if (!branchId)
      throw new ForbiddenException(
        'همه اعضای گروه باید یک شعبه مجاز مشترک داشته باشند.',
      );
    const byId = new Map(rows.map((row) => [row.id, row]));
    return {
      branchId,
      contacts: ids.map((id) => {
        const row = byId.get(id)!;
        return {
          id: row.id,
          displayName: row.displayName,
          username: row.username,
          branches: row.branches.map(({ branch }) => branch),
        };
      }),
    };
  }

  async describeMessagingParticipants(ids: string[]) {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return [];
    return this.database.client.user.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true, displayName: true, username: true },
    });
  }

  async listUserAccessOptions(actor: AuthenticatedActor) {
    const isAdministrator = await this.isSystemAdministrator(actor);
    const [permissions, branches] = await Promise.all([
      this.database.client.permission.findMany({
        where: isAdministrator
          ? { NOT: { code: { startsWith: 'ui.' } } }
          : {
              code: {
                in: actor.permissions.filter((code) => !code.startsWith('ui.')),
              },
            },
        orderBy: [{ module: 'asc' }, { code: 'asc' }],
        select: { id: true, code: true, name: true, module: true },
      }),
      this.database.client.branch.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ]);
    return {
      permissions,
      branches,
      assignableScreenIds: isAdministrator
        ? USER_ACCESS_SCREENS.map(({ id }) => id)
        : USER_ACCESS_SCREENS.filter(({ id }) =>
            canViewScreen(actor.permissions, id),
          ).map(({ id }) => id),
      assignableControlIds: isAdministrator
        ? USER_ACCESS_DENY_CONTROLS.map(({ id }) => id)
        : USER_ACCESS_DENY_CONTROLS.filter((control) =>
            this.canDelegateControl(actor, control.id, control.group),
          ).map(({ id }) => id),
      canAssignAll: isAdministrator,
    };
  }

  listRolesAndBranches() {
    return Promise.all([
      this.database.client.role.findMany({
        where: {
          isActive: true,
          NOT: [
            { code: { startsWith: 'personal-access-' } },
            { code: { startsWith: MANUAL_ACCESS_ROLE_PREFIX } },
          ],
        },
        include: { permissions: { include: { permission: true } } },
        orderBy: { name: 'asc' },
      }),
      this.database.client.branch.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.database.client.permission.findMany({
        where: { NOT: { code: { startsWith: 'ui.' } } },
        orderBy: [{ module: 'asc' }, { code: 'asc' }],
      }),
    ]).then(([roles, branches, permissions]) => ({
      roles,
      branches,
      permissions,
    }));
  }

  listSessions(actor: AuthenticatedActor) {
    return this.database.client.session.findMany({
      where: { userId: actor.userId },
      take: 100,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
      },
    });
  }

  async listAdministrativeSessions(actor: AuthenticatedActor, userId?: string) {
    const rows = await this.database.client.session.findMany({
      ...(userId ? { where: { userId } } : {}),
      take: 500,
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
        user: { select: { id: true, username: true, displayName: true } },
      },
    });
    const now = Date.now();
    return rows.map((row) => ({
      contract: 'system.session.v1' as const,
      id: row.id,
      user: row.user,
      status:
        row.status === SessionStatus.ACTIVE && row.expiresAt.getTime() <= now
          ? ('EXPIRED' as const)
          : row.status,
      isCurrent: row.id === actor.sessionId,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
      ipAddressMasked: this.maskIp(row.ipAddress),
      userAgentSummary: this.summarizeUserAgent(row.userAgent),
    }));
  }

  async revokeAdministrativeSession(
    sessionId: string,
    actor: AuthenticatedActor,
    reasonInput: string,
    confirmCurrentSession: boolean,
    metadata: RequestMetadata,
  ) {
    const reason = this.validAdministrativeReason(reasonInput);
    if (sessionId === actor.sessionId && !confirmCurrentSession)
      throw new ConflictException(
        'برای بستن نشست جاری باید تأیید صریح ارسال شود.',
      );
    const session = await this.database.client.session.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, userId: true },
    });
    if (!session) throw new NotFoundException('نشست پیدا نشد.');
    if (session.status === SessionStatus.ACTIVE)
      await this.database.client.session.update({
        where: { id: sessionId },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
          revokedReason: `admin:${reason}`.slice(0, 160),
        },
      });
    await this.audit(
      actor.userId,
      'system.session.revoke',
      'Session',
      sessionId,
      AuditOutcome.SUCCESS,
      metadata,
      { targetUserId: session.userId, reason },
    );
    return { id: sessionId, status: SessionStatus.REVOKED };
  }

  async revokeAdministrativeUserSessions(
    userId: string,
    actor: AuthenticatedActor,
    reasonInput: string,
    includeCurrentSession: boolean,
    confirmCurrentSession: boolean,
    metadata: RequestMetadata,
  ) {
    const reason = this.validAdministrativeReason(reasonInput);
    if (
      userId === actor.userId &&
      includeCurrentSession &&
      !confirmCurrentSession
    )
      throw new ConflictException(
        'برای بستن نشست جاری باید تأیید صریح ارسال شود.',
      );
    const user = await this.database.client.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('کاربر پیدا نشد.');
    const result = await this.database.client.session.updateMany({
      where: {
        userId,
        status: SessionStatus.ACTIVE,
        ...(!includeCurrentSession ? { id: { not: actor.sessionId } } : {}),
      },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: `admin:${reason}`.slice(0, 160),
      },
    });
    await this.audit(
      actor.userId,
      'system.user.sessions.revoke',
      'User',
      userId,
      AuditOutcome.SUCCESS,
      metadata,
      { reason, revokedCount: String(result.count) },
    );
    return { userId, revokedCount: result.count };
  }

  async mfaStatus(actor: AuthenticatedActor) {
    const user = await this.database.client.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: {
        mfaTotpEnabledAt: true,
        mfaTotpPendingExpiresAt: true,
        mfaLockedUntil: true,
      },
    });
    const now = new Date();
    return {
      data: {
        enabled: Boolean(user.mfaTotpEnabledAt),
        setupPending: Boolean(
          user.mfaTotpPendingExpiresAt && user.mfaTotpPendingExpiresAt > now,
        ),
        lockedUntil:
          user.mfaLockedUntil && user.mfaLockedUntil > now
            ? user.mfaLockedUntil.toISOString()
            : null,
      },
    };
  }

  async beginMfaSetup(
    actor: AuthenticatedActor,
    currentPassword: string,
    metadata: RequestMetadata,
  ) {
    const user = await this.database.client.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: {
        id: true,
        username: true,
        passwordHash: true,
        mfaFailedAttempts: true,
        mfaLockedUntil: true,
      },
    });
    this.assertMfaNotLocked(user.mfaLockedUntil);
    const passwordValid = await verify(
      user.passwordHash,
      currentPassword,
    ).catch(() => false);
    if (!passwordValid) {
      await this.recordMfaFailure(user, 'auth.mfa.setup.password', metadata);
      throw new UnauthorizedException({
        code: 'IAM_MFA_PASSWORD_INVALID',
        message: 'رمز عبور فعلی صحیح نیست.',
      });
    }
    const secret = this.mfaTotp.generateSecret();
    const expiresAt = new Date(Date.now() + MFA_SETUP_TTL_MINUTES * 60_000);
    await this.database.client.user.update({
      where: { id: user.id },
      data: {
        mfaTotpPendingSecretCiphertext: this.mfaTotp.encrypt(user.id, secret),
        mfaTotpPendingExpiresAt: expiresAt,
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
      },
    });
    await this.audit(
      actor.userId,
      'auth.mfa.setup.begin',
      'User',
      actor.userId,
      AuditOutcome.SUCCESS,
      metadata,
    );
    return {
      data: {
        manualKey: secret,
        otpAuthUri: this.mfaTotp.otpAuthUri(user.username, secret),
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async confirmMfaSetup(
    actor: AuthenticatedActor,
    code: string,
    metadata: RequestMetadata,
  ) {
    const user = await this.database.client.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: {
        id: true,
        mfaTotpPendingSecretCiphertext: true,
        mfaTotpPendingExpiresAt: true,
        mfaFailedAttempts: true,
        mfaLockedUntil: true,
      },
    });
    this.assertMfaNotLocked(user.mfaLockedUntil);
    const now = new Date();
    if (
      !user.mfaTotpPendingSecretCiphertext ||
      !user.mfaTotpPendingExpiresAt ||
      user.mfaTotpPendingExpiresAt <= now
    ) {
      throw new ConflictException({
        code: 'IAM_MFA_SETUP_EXPIRED',
        message: 'فرایند فعال‌سازی منقضی شده است؛ دوباره شروع کنید.',
      });
    }
    const secret = this.mfaTotp.decrypt(
      user.id,
      user.mfaTotpPendingSecretCiphertext,
    );
    const matchedStep = this.mfaTotp.verify(secret, code, now.getTime());
    if (matchedStep === null) {
      await this.recordMfaFailure(user, 'auth.mfa.setup.confirm', metadata);
      throw new UnauthorizedException({
        code: 'IAM_MFA_CODE_INVALID',
        message: 'کد شش‌رقمی صحیح نیست یا منقضی شده است.',
      });
    }
    await this.database.client.user.update({
      where: { id: user.id },
      data: {
        mfaTotpSecretCiphertext: user.mfaTotpPendingSecretCiphertext,
        mfaTotpPendingSecretCiphertext: null,
        mfaTotpPendingExpiresAt: null,
        mfaTotpEnabledAt: now,
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
        mfaLastUsedStep: BigInt(matchedStep),
      },
    });
    await this.audit(
      actor.userId,
      'auth.mfa.setup.confirm',
      'User',
      actor.userId,
      AuditOutcome.SUCCESS,
      metadata,
    );
    return this.mfaStatus(actor);
  }

  async verifyStepUp(
    actor: AuthenticatedActor,
    code: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    const user = await this.database.client.user.findUniqueOrThrow({
      where: { id: actor.userId },
      select: {
        id: true,
        mfaTotpSecretCiphertext: true,
        mfaTotpEnabledAt: true,
        mfaFailedAttempts: true,
        mfaLockedUntil: true,
        mfaLastUsedStep: true,
      },
    });
    this.assertMfaNotLocked(user.mfaLockedUntil);
    if (!user.mfaTotpEnabledAt || !user.mfaTotpSecretCiphertext) {
      await this.audit(
        actor.userId,
        'auth.mfa.step_up',
        'User',
        actor.userId,
        AuditOutcome.FAILURE,
        metadata,
        { reason: 'not-enrolled' },
      );
      throw new ForbiddenException({
        code: 'IAM_MFA_NOT_ENROLLED',
        message: 'ابتدا اعتبارسنجی دومرحله‌ای حساب را فعال کنید.',
      });
    }
    const now = new Date();
    const secret = this.mfaTotp.decrypt(user.id, user.mfaTotpSecretCiphertext);
    const matchedStep = this.mfaTotp.verify(secret, code, now.getTime());
    if (
      matchedStep === null ||
      (user.mfaLastUsedStep !== null &&
        BigInt(matchedStep) <= user.mfaLastUsedStep)
    ) {
      await this.recordMfaFailure(user, 'auth.mfa.step_up', metadata);
      throw new UnauthorizedException({
        code:
          matchedStep === null
            ? 'IAM_MFA_CODE_INVALID'
            : 'IAM_MFA_CODE_REPLAYED',
        message:
          matchedStep === null
            ? 'کد شش‌رقمی صحیح نیست یا منقضی شده است.'
            : 'این کد قبلاً استفاده شده است؛ کد بعدی را وارد کنید.',
      });
    }
    const claimed = await this.database.client.user.updateMany({
      where: {
        id: user.id,
        OR: [
          { mfaLastUsedStep: null },
          { mfaLastUsedStep: { lt: BigInt(matchedStep) } },
        ],
      },
      data: {
        mfaLastUsedStep: BigInt(matchedStep),
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
      },
    });
    if (claimed.count !== 1) {
      await this.audit(
        actor.userId,
        'auth.mfa.step_up',
        'User',
        actor.userId,
        AuditOutcome.FAILURE,
        metadata,
        { reason: 'concurrent-replay' },
      );
      throw new UnauthorizedException({
        code: 'IAM_MFA_CODE_REPLAYED',
        message: 'این کد قبلاً استفاده شده است؛ کد بعدی را وارد کنید.',
      });
    }
    await this.audit(
      actor.userId,
      'auth.mfa.step_up',
      'User',
      actor.userId,
      AuditOutcome.SUCCESS,
      metadata,
    );
  }

  async revokeSession(
    sessionId: string,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    await this.database.client.session.updateMany({
      where: { id: sessionId, userId: actor.userId },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: 'user-revoked',
      },
    });
    await this.audit(
      actor.userId,
      'auth.session.revoke',
      'Session',
      sessionId,
      AuditOutcome.SUCCESS,
      metadata,
    );
  }

  async listRoleTemplates() {
    const roles = await this.database.client.role.findMany({
      where: { ...reusableRoleWhere, isActive: true },
      include: { permissions: { include: { permission: true } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return roles
      .sort(
        (a, b) =>
          Number(b.code.startsWith(ROLE_TEMPLATE_PREFIX)) -
          Number(a.code.startsWith(ROLE_TEMPLATE_PREFIX)),
      )
      .map((role) => ({ ...role, selection: roleOptionSelection(role) }));
  }
  async updateUserDetails(
    userId: string,
    dto: UpdateUserDetailsDto,
    actor: AuthenticatedActor,
  ) {
    const displayName = dto.displayName.trim();
    if (
      displayName.length < 2 ||
      displayName.length > 160 ||
      !/^[a-f0-9]{64}$/.test(dto.revision)
    )
      throw new BadRequestException(
        'نام و نام خانوادگی یا نسخهٔ اطلاعات معتبر نیست.',
      );
    return this.database.client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('iam-administrator-membership'))::text`;
        await tx.$queryRaw`SELECT id FROM iam_users WHERE id IN (${actor.userId}::uuid, ${userId}::uuid) ORDER BY id FOR UPDATE`;
        const operator = await tx.user.findUnique({
          where: { id: actor.userId },
          include: manualUserInclude,
        });
        if (
          operator?.status !== UserStatus.ACTIVE ||
          !authenticatedPermissionCodes(operator.roles).includes(
            'iam.users.manage',
          )
        )
          throw new ForbiddenException();
        const target = await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            username: true,
            displayName: true,
            updatedAt: true,
            profile: { select: { organizationUnitId: true } },
            branches: { select: { branchId: true } },
          },
        });
        if (!target) throw new NotFoundException('کاربر پیدا نشد.');
        if (userDetailsRevision(target) !== dto.revision)
          throw new ConflictException(
            'اطلاعات کاربر تغییر کرده است؛ دوباره بارگذاری کنید.',
          );
        const oldUnitId = target.profile?.organizationUnitId ?? null;
        const unitChanged =
          dto.organizationUnitId !== undefined &&
          dto.organizationUnitId !== oldUnitId;
        if (unitChanged && dto.organizationUnitId) {
          await this.units.assertAssignable(
            tx,
            dto.organizationUnitId,
            {
              ...actor,
              permissions: authenticatedPermissionCodes(operator.roles),
              branchIds: operator.branches.map((branch) => branch.branchId),
            },
            target.branches.map((branch) => branch.branchId),
          );
        }
        if (target.displayName === displayName && !unitChanged)
          return { ...target, detailsRevision: userDetailsRevision(target) };
        if (unitChanged)
          await tx.iamUserProfile.upsert({
            where: { userId },
            create: {
              userId,
              organizationUnitId: dto.organizationUnitId ?? null,
            },
            update: { organizationUnitId: dto.organizationUnitId ?? null },
          });
        const updated = await tx.user.update({
          where: { id: userId },
          data: { displayName },
          select: {
            id: true,
            username: true,
            displayName: true,
            updatedAt: true,
            profile: { select: { organizationUnitId: true } },
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: actor.userId,
            action: 'iam.user.details.update',
            entityType: 'User',
            entityId: userId,
            outcome: AuditOutcome.SUCCESS,
          },
        });
        return {
          ...updated,
          organizationUnitId: updated.profile?.organizationUnitId ?? null,
          detailsRevision: userDetailsRevision(updated),
        };
      },
      { timeout: 30_000 },
    );
  }
  async listRoleDirectory(actor: AuthenticatedActor) {
    if (!(await this.isSystemAdministrator(actor)))
      throw new ForbiddenException();
    const roles = await this.database.client.role.findMany({
      where: reusableRoleWhere,
      include: {
        users: { select: { userId: true } },
        permissions: { select: { permissionId: true } },
      },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      code: role.code,
      isActive: role.isActive,
      isSystem: role.isSystem || role.code === 'administrator',
      userCount: role.users.length,
      isTemplate: role.code.startsWith(ROLE_TEMPLATE_PREFIX),
      revision: roleDirectoryRevision(role),
      canDelete:
        !role.isSystem &&
        role.code !== 'administrator' &&
        !isPrivateUserRole(role.code) &&
        role.users.length === 0,
    }));
  }
  async deleteRole(
    roleId: string,
    revision: string,
    actor: AuthenticatedActor,
  ) {
    if (typeof revision !== 'string' || !/^[a-f0-9]{64}$/.test(revision))
      throw new BadRequestException('نسخهٔ معتبر نقش برای حذف لازم است.');
    return this.database.client.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('iam-administrator-membership'))::text`;
        await tx.$queryRaw`SELECT id FROM iam_users WHERE id = ${actor.userId}::uuid FOR UPDATE`;
        const operator = await tx.user.findUnique({
          where: { id: actor.userId },
          include: manualUserInclude,
        });
        if (
          operator?.status !== UserStatus.ACTIVE ||
          !operator.roles.some(
            ({ role }) => role.isActive && role.code === 'administrator',
          ) ||
          !authenticatedPermissionCodes(operator.roles).includes(
            'iam.users.manage',
          )
        )
          throw new ForbiddenException(
            'حذف نقش فقط برای مدیر سامانه مجاز است.',
          );
        await tx.$queryRaw`SELECT id FROM iam_roles WHERE id = ${roleId}::uuid FOR UPDATE`;
        const role = await tx.role.findUnique({
          where: { id: roleId },
          include: {
            users: { select: { userId: true } },
            permissions: { select: { permissionId: true } },
          },
        });
        if (!role) throw new NotFoundException('نقش پیدا نشد.');
        if (
          role.isSystem ||
          role.code === 'administrator' ||
          isPrivateUserRole(role.code)
        )
          throw new ConflictException(
            'نقش سیستمی یا اختصاصی کاربر قابل حذف نیست.',
          );
        if (role.users.length)
          throw new ConflictException(
            'این نقش به کاربر متصل است؛ ابتدا نقش کاربران را تغییر دهید.',
          );
        if (roleDirectoryRevision(role) !== revision)
          throw new ConflictException(
            'نقش تغییر کرده است؛ فهرست را دوباره بارگذاری کنید.',
          );
        await tx.role.delete({ where: { id: roleId } });
        await tx.auditEvent.create({
          data: {
            actorUserId: actor.userId,
            action: 'iam.role.delete',
            entityType: 'Role',
            entityId: roleId,
            outcome: AuditOutcome.SUCCESS,
          },
        });
        return { success: true };
      },
      { timeout: 30_000 },
    );
  }
  async saveRoleTemplate(
    dto: {
      accessTitle?: string;
      permissionIds?: string[];
      screenIds?: string[];
      deniedControlIds?: string[];
    },
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    if (!(await this.isSystemAdministrator(actor)))
      throw new ForbiddenException(
        'Only system administrators can configure role defaults.',
      );
    const profile = await this.managedAccess(
      {
        ...dto,
        ...(dto.accessTitle !== undefined
          ? { accessTitle: dto.accessTitle.trim() }
          : {}),
        manualAccessV3: true,
      },
      actor,
    );
    if (!profile || !Array.isArray(dto.deniedControlIds))
      throw new BadRequestException(
        'Complete role access settings are required.',
      );
    const key =
      'template-job-' +
      (USER_JOB_TITLES.includes(
        profile.title as (typeof USER_JOB_TITLES)[number],
      )
        ? USER_JOB_TITLES.indexOf(
            profile.title as (typeof USER_JOB_TITLES)[number],
          )
        : createHash('sha256')
            .update(profile.title)
            .digest('hex')
            .slice(0, 32));
    const id = await this.database.client.$transaction(
      async (tx) =>
        this.personalAccessRole(
          tx,
          key,
          { ...profile, deniedControlIds: dto.deniedControlIds! },
          actor,
        ),
      { timeout: 60_000 },
    );
    await this.audit(
      actor.userId,
      'iam.role.template.update',
      'Role',
      id,
      AuditOutcome.SUCCESS,
      metadata,
    );
    return { id };
  }
  async createRole(
    dto: CreateRoleDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    if (
      dto.code.startsWith(MANUAL_ACCESS_ROLE_PREFIX) ||
      dto.code.startsWith('personal-access-')
    )
      throw new BadRequestException('پیشوند نقش اختصاصی رزرو شده است.');
    const codes = await this.assertPermissionsAssignable(
      dto.permissionIds,
      actor,
    );
    this.assertPermissionCodesAssignable(
      salesManagerRolePermissions([
        { role: { code: dto.code, name: dto.name.trim(), isActive: true } },
      ]),
      actor,
    );
    const rolePermissionIds = [...dto.permissionIds];
    if (
      codes.some((code) => code.startsWith('customer_affairs.call_center.'))
    ) {
      const flag = await this.database.client.permission.upsert({
        where: { code: CALL_CENTER_SCOPED_ACCESS },
        create: {
          code: CALL_CENTER_SCOPED_ACCESS,
          module: 'customer_affairs',
          name: 'محدوده امن کال سنتر نسخه ۱',
        },
        update: {},
        select: { id: true },
      });
      if (!rolePermissionIds.includes(flag.id)) rolePermissionIds.push(flag.id);
    }
    const role = await this.database.client.role.create({
      data: {
        code: dto.code,
        name: dto.name.trim(),
        permissions: {
          create: rolePermissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: { permissions: { include: { permission: true } } },
    });
    await this.audit(
      actor.userId,
      'iam.role.create',
      'Role',
      role.id,
      AuditOutcome.SUCCESS,
      metadata,
    );
    return role;
  }

  listAuditEvents() {
    return this.database.client.auditEvent.findMany({
      take: 200,
      orderBy: { occurredAt: 'desc' },
      select: {
        id: true,
        actorUserId: true,
        action: true,
        entityType: true,
        entityId: true,
        outcome: true,
        occurredAt: true,
      },
    });
  }

  async listSelfActivity(actor: AuthenticatedActor) {
    const rows = await this.database.client.auditEvent.findMany({
      where: { actorUserId: actor.userId, outcome: AuditOutcome.SUCCESS },
      take: 100,
      orderBy: { occurredAt: 'desc' },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        occurredAt: true,
      },
    });
    return {
      data: rows.map((row) => ({
        ...row,
        occurredAt: row.occurredAt.toISOString(),
      })),
    };
  }

  recordSelfActivity(
    actor: AuthenticatedActor,
    action: string,
    entityType: string,
    entityId?: string,
  ) {
    return this.audit(
      actor.userId,
      action,
      entityType,
      entityId,
      AuditOutcome.SUCCESS,
      {},
    );
  }

  async personalProfile(userId: string) {
    return this.database.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        profile: {
          select: { phone: true, photoDocumentId: true, updatedAt: true },
        },
      },
    });
  }

  async updateOwnProfile(
    actor: AuthenticatedActor,
    input: IamPersonalProfileUpdateInputV1,
  ) {
    const displayName = input.displayName.trim();
    const email = input.email?.trim().toLowerCase() || null;
    const phone = input.phone?.trim() || null;
    if (displayName.length < 2 || displayName.length > 160)
      throw new BadRequestException('نام نمایشی معتبر نیست.');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException('ایمیل معتبر نیست.');
    if (phone && !/^\+?[0-9۰-۹٠-٩ -]{7,32}$/.test(phone))
      throw new BadRequestException('شماره تماس معتبر نیست.');
    try {
      return await this.database.client.$transaction(async (transaction) => {
        const [identity, profile] = await Promise.all([
          transaction.user.update({
            where: { id: actor.userId },
            data: { displayName, email },
            select: { id: true, displayName: true, email: true },
          }),
          transaction.iamUserProfile.upsert({
            where: { userId: actor.userId },
            create: {
              userId: actor.userId,
              phone,
              photoDocumentId: input.photoDocumentId ?? null,
            },
            update: {
              phone,
              photoDocumentId: input.photoDocumentId ?? null,
            },
          }),
        ]);
        await transaction.auditEvent.create({
          data: {
            actorUserId: actor.userId,
            action: 'iam.profile.update',
            entityType: 'User',
            entityId: actor.userId,
            outcome: AuditOutcome.SUCCESS,
          },
        });
        return { ...identity, profile };
      });
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'P2002'
      )
        throw new ConflictException(
          'این ایمیل قبلاً برای حساب دیگری ثبت شده است.',
        );
      throw error;
    }
  }

  async createUser(
    dto: CreateUserDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const profile = await this.managedAccess(dto, actor);
    if (dto.manualAccessV3 && !profile?.managed)
      throw new BadRequestException('انتخاب دسترسی دستی لازم است.');
    if (dto.roleIds) await this.assertRolesAssignable(dto.roleIds, actor);
    const passwordErrors = initialPasswordPolicyErrors(dto.password);
    if (passwordErrors.length || dto.password.length > 200)
      throw new BadRequestException({
        code: 'IAM_PASSWORD_POLICY',
        message: passwordErrors.join(' ') || 'رمز باید حداکثر ۲۰۰ نویسه باشد.',
      });
    const username = dto.username.trim().toLowerCase();
    const email = dto.email?.trim().toLowerCase() || null;
    const exists = await this.database.client.user.findFirst({
      where: { OR: [{ username }, ...(email ? [{ email }] : [])] },
      select: { id: true },
    });
    if (exists)
      throw new ConflictException(
        'این نام کاربری یا ایمیل قبلاً استفاده شده است.',
      );
    const passwordHash = await hash(dto.password, {
      type: 2,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
    const managedUserId = randomUUID();
    const create = async (transaction: Prisma.TransactionClient) => {
      if (dto.organizationUnitId) {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('iam-administrator-membership'))::text`;
        await transaction.$queryRaw`SELECT id FROM iam_users WHERE id = ${actor.userId}::uuid FOR UPDATE`;
        const operator = await transaction.user.findUnique({
          where: { id: actor.userId },
          include: manualUserInclude,
        });
        if (
          operator?.status !== UserStatus.ACTIVE ||
          !authenticatedPermissionCodes(operator.roles).includes(
            'iam.users.manage',
          )
        )
          throw new ForbiddenException();
        await this.units.assertAssignable(
          transaction,
          dto.organizationUnitId,
          {
            ...actor,
            permissions: authenticatedPermissionCodes(operator.roles),
            branchIds: operator.branches.map((branch) => branch.branchId),
          },
          dto.branchIds,
        );
      }
      const assignedRoleIds = dto.manualAccessV3
        ? []
        : profile
          ? [
              await this.personalAccessRole(
                transaction,
                managedUserId,
                {
                  ...profile,
                  deniedControlIds: profile.deniedControlIds ?? [],
                },
                actor,
              ),
            ]
          : dto.roleIds;
      const created = await transaction.user.create({
        data: {
          ...(profile ? { id: managedUserId } : {}),
          username,
          email,
          displayName: dto.displayName.trim(),
          passwordHash,
          ...(dto.organizationUnitId
            ? {
                profile: {
                  create: { organizationUnitId: dto.organizationUnitId },
                },
              }
            : {}),
          roles: { create: assignedRoleIds.map((roleId) => ({ roleId })) },
          branches: {
            create: dto.branchIds.map((branchId, index) => ({
              branchId,
              isPrimary: index === 0,
            })),
          },
        },
        select: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          status: true,
        },
      });
      if (dto.manualAccessV3 && profile) {
        await persistManualSnapshot(transaction, created.id, profile.title, {
          permissionCodes: [
            ...new Set([
              ...profile.permissionCodes,
              ...(profile.permissionCodes.some((code) =>
                code.startsWith('customer_affairs.call_center.'),
              ) || profile.screenIds.includes('customer-affairs.call-center')
                ? [CALL_CENTER_SCOPED_ACCESS]
                : []),
            ]),
          ],
          screenIds: profile.screenIds,
          allowedControlIds: USER_ACCESS_DENY_CONTROLS.filter(
            (control) =>
              !(profile.deniedControlIds ?? []).includes(control.id) &&
              (control.kind === 'field' ||
                control.id.startsWith('master-data.resource.') ||
                profile.screenIds.includes(control.id)),
          ).map((control) => control.id),
        });
      }
      return created;
    };
    const user =
      profile || dto.organizationUnitId
        ? await this.database.client.$transaction(create, { timeout: 60000 })
        : await create(this.database.client);
    await this.audit(
      actor.userId,
      'iam.user.create',
      'User',
      user.id,
      AuditOutcome.SUCCESS,
      metadata,
    );
    return user;
  }

  async updateUserAccess(
    userId: string,
    dto: UpdateUserAccessDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const profile = await this.managedAccess(dto, actor, true);
    if (dto.roleIds) await this.assertRolesAssignable(dto.roleIds, actor);
    await this.database.client.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('iam-administrator-membership'))::text`;
      const [target, administratorRole] = await Promise.all([
        transaction.user.findUnique({
          where: { id: userId },
          select: {
            status: true,
            profile: { select: { organizationUnitId: true } },
            roles: {
              select: {
                roleId: true,
                role: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                    isActive: true,
                    permissions: {
                      select: {
                        permission: { select: { id: true, code: true } },
                      },
                    },
                  },
                },
              },
            },
            branches: {
              select: { branch: { select: { id: true } } },
            },
          },
        }),
        transaction.role.findUnique({
          where: { code: 'administrator' },
          select: { id: true },
        }),
      ]);
      if (!target) throw new NotFoundException('کاربر پیدا نشد.');
      if (
        (profile || dto.roleIds) &&
        target.roles.some(({ role }) =>
          role.code?.startsWith(MANUAL_ACCESS_ROLE_PREFIX),
        )
      )
        throw new ConflictException(
          'این حساب از دسترسی دستی استفاده می‌کند؛ فرم جدید دسترسی را باز کنید.',
        );
      if (
        dto.accessRevision &&
        dto.accessRevision !== this.accessRevision(target)
      )
        throw new ConflictException({
          code: 'IAM_ACCESS_STALE',
          message:
            'دسترسی کاربر تغییر کرده است؛ اطلاعات را دوباره بارگذاری کنید.',
        });
      if (
        dto.roleIds &&
        administratorRole &&
        target.status === UserStatus.ACTIVE &&
        target.roles.some(({ roleId }) => roleId === administratorRole.id) &&
        !dto.roleIds.includes(administratorRole.id)
      ) {
        const activeAdministrators = await transaction.user.count({
          where: {
            status: UserStatus.ACTIVE,
            roles: { some: { roleId: administratorRole.id } },
          },
        });
        if (activeAdministrators <= 1)
          throw new ConflictException(
            'حذف نقش آخرین مدیر فعال سامانه مجاز نیست.',
          );
      }
      if (profile) {
        const personalCode = `personal-access-${userId}`;
        const inheritedDenied = target.roles
          .filter(({ role }) => role.isActive && role.code !== personalCode)
          .flatMap(({ role }) =>
            role.permissions
              .map(({ permission }) => permission.code)
              .filter((code) => code.startsWith('ui.deny.'))
              .map((code) => code.slice('ui.deny.'.length)),
          );
        const currentDenied = target.roles
          .filter(({ role }) => role.isActive)
          .flatMap(({ role }) =>
            role.permissions
              .map(({ permission }) => permission.code)
              .filter((code) => code.startsWith('ui.deny.'))
              .map((code) => code.slice('ui.deny.'.length)),
          )
          .sort();
        const requestedDenied = [
          ...(profile.deniedControlIds ?? currentDenied),
        ].sort();
        if (!profile.canAssignAll) {
          const changedControls = new Set([
            ...requestedDenied.filter((id) => !currentDenied.includes(id)),
            ...currentDenied.filter((id) => !requestedDenied.includes(id)),
          ]);
          for (const id of changedControls) {
            const control = USER_ACCESS_DENY_CONTROLS.find(
              (item) => item.id === id,
            );
            if (control && !this.canDelegateControl(actor, id, control.group))
              throw new ForbiddenException(
                'تغییر محدودیت خارج از اختیار واگذاری شما است.',
              );
          }
        }
        if (
          inheritedDenied.some(
            (controlId) => !requestedDenied.includes(controlId),
          )
        )
          throw new ConflictException({
            code: 'IAM_INHERITED_RESTRICTION',
            message:
              'محدودیت ارث‌رسیده از نقش مشترک باید در همان نقش تغییر کند.',
          });
        const personalRole = target.roles.find(
          ({ role }) => role.code === personalCode,
        )?.role;
        const personalProfile = {
          ...profile,
          deniedControlIds: requestedDenied.filter(
            (controlId) => !inheritedDenied.includes(controlId),
          ),
        };
        const desiredManagedCodes = [
          USER_ACCESS_PROFILE_PERMISSION,
          ...profile.permissionCodes,
          ...profile.screenIds.map(screenPermission),
          ...personalProfile.deniedControlIds.map(denyPermission),
        ].sort();
        const currentManagedCodes = (personalRole?.permissions ?? [])
          .map(({ permission }) => permission.code)
          .filter((code) => {
            if (code === USER_ACCESS_PROFILE_PERMISSION) return true;
            if (code.startsWith('ui.screen.'))
              return USER_ACCESS_SCREENS.some(
                ({ id }) => screenPermission(id) === code,
              );
            if (code.startsWith('ui.deny.'))
              return isUserAccessControlId(code.slice('ui.deny.'.length));
            return (
              (IAM_PERMISSION_CODES as readonly string[]).includes(code) &&
              (profile.canAssignAll ||
                actor.permissions.includes(code as IamPermissionCode))
            );
          })
          .sort();
        const managedNoop =
          profile.managed &&
          personalRole?.name === profile.title &&
          JSON.stringify(currentManagedCodes) ===
            JSON.stringify(desiredManagedCodes);
        const restrictionNoop =
          !profile.managed &&
          JSON.stringify(currentDenied) === JSON.stringify(requestedDenied);
        if (!restrictionNoop && !managedNoop) {
          if (!profile.managed && personalRole && !personalRole.isActive)
            throw new ConflictException({
              code: 'IAM_INACTIVE_PERSONAL_ROLE',
              message:
                'نقش اختصاصی این حساب غیرفعال است؛ برای حفظ دسترسی فعلی، ابتدا وضعیت نقش را بررسی کنید.',
            });
          const personalRoleId = await this.personalAccessRole(
            transaction,
            userId,
            personalProfile,
            actor,
          );
          if (!target.roles.some(({ roleId }) => roleId === personalRoleId))
            await transaction.userRole.createMany({
              data: [{ userId, roleId: personalRoleId }],
              skipDuplicates: true,
            });
        }
      } else if (dto.roleIds) {
        await transaction.userRole.deleteMany({ where: { userId } });
        if (dto.roleIds.length)
          await transaction.userRole.createMany({
            data: dto.roleIds.map((roleId) => ({ userId, roleId })),
          });
      }
      if (dto.branchIds) {
        if (target.profile?.organizationUnitId)
          await this.units.assertRetainedBranch(
            transaction,
            target.profile.organizationUnitId,
            dto.branchIds,
          );
        await transaction.userBranch.deleteMany({ where: { userId } });
        if (dto.branchIds.length)
          await transaction.userBranch.createMany({
            data: dto.branchIds.map((branchId, index) => ({
              userId,
              branchId,
              isPrimary: index === 0,
            })),
          });
      }
    });
    await this.audit(
      actor.userId,
      'iam.user.access.update',
      'User',
      userId,
      AuditOutcome.SUCCESS,
      metadata,
    );
    return { id: userId };
  }

  async updateUserStatus(
    userId: string,
    status: UserStatus,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    if (userId === actor.userId && status !== UserStatus.ACTIVE)
      throw new ConflictException('غیرفعال‌سازی حساب جاری مجاز نیست.');
    const user = await this.database.client.$transaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('iam-administrator-membership'))::text`;
        if (status !== UserStatus.ACTIVE) {
          const manualTarget = await transaction.userRole.findFirst({
            where: {
              userId,
              role: { code: { startsWith: MANUAL_ACCESS_ROLE_PREFIX } },
            },
            select: { userId: true },
          });
          if (manualTarget) {
            const users = await transaction.user.findMany({
              where: { status: UserStatus.ACTIVE },
              include: manualUserInclude,
            });
            const managers = users.filter((entry) => {
              const codes = authenticatedPermissionCodes(entry.roles);
              return (
                codes.includes('iam.users.manage') &&
                codes.includes('iam.users.read') &&
                canViewScreen(codes, 'system.users')
              );
            });
            if (
              managers.some((entry) => entry.id === userId) &&
              managers.length <= 1
            )
              throw new ConflictException(
                'غیرفعال‌سازی آخرین مدیر دسترسی مجاز نیست.',
              );
          }
          const targetIsAdministrator = await transaction.userRole.findFirst({
            where: { userId, role: { code: 'administrator' } },
            select: { userId: true },
          });
          if (targetIsAdministrator) {
            const activeAdministrators = await transaction.user.count({
              where: {
                status: UserStatus.ACTIVE,
                roles: { some: { role: { code: 'administrator' } } },
              },
            });
            if (activeAdministrators <= 1)
              throw new ConflictException(
                'غیرفعال‌سازی آخرین مدیر فعال سامانه مجاز نیست.',
              );
          }
        }
        return transaction.user.update({
          where: { id: userId },
          data: { status, failedLoginAttempts: 0, lockedUntil: null },
          select: { id: true, status: true },
        });
      },
    );
    if (status !== UserStatus.ACTIVE)
      await this.database.client.session.updateMany({
        where: { userId, status: SessionStatus.ACTIVE },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: new Date(),
          revokedReason: 'user-disabled',
        },
      });
    await this.audit(
      actor.userId,
      'iam.user.status.update',
      'User',
      userId,
      AuditOutcome.SUCCESS,
      metadata,
      { status },
    );
    return user;
  }

  async bootstrapAdministrator(
    usernameInput: string,
    emailInput: string | undefined,
    password: string,
    displayName: string,
  ): Promise<string> {
    const username = usernameInput.trim().toLowerCase();
    const email = emailInput?.trim().toLowerCase() || null;
    const [role, branch, existingUser] = await Promise.all([
      this.database.client.role.findUniqueOrThrow({
        where: { code: 'administrator' },
      }),
      this.database.client.branch.findUniqueOrThrow({ where: { code: 'HQ' } }),
      this.database.client.user.findUnique({ where: { username } }),
    ]);
    let user = existingUser;
    if (!user) {
      assertStrongPassword(password);
      const passwordHash = await hash(password, {
        type: 2,
        memoryCost: 65_536,
        timeCost: 3,
        parallelism: 1,
      });
      user = await this.database.client.user.upsert({
        where: { username },
        create: { username, email, displayName, passwordHash },
        update: {},
      });
    }
    await this.database.client.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id },
      update: {},
    });
    await this.database.client.userBranch.upsert({
      where: { userId_branchId: { userId: user.id, branchId: branch.id } },
      create: { userId: user.id, branchId: branch.id, isPrimary: true },
      update: { isPrimary: true },
    });
    await this.audit(
      user.id,
      'iam.bootstrap.administrator',
      'User',
      user.id,
      AuditOutcome.SUCCESS,
      {},
      { result: existingUser ? 'existing-user-preserved' : 'created' },
    );
    return user.id;
  }

  private async rejectRefresh(
    session: {
      familyId: string;
      id: string;
      revokedAt: Date | null;
      revokedReason: string | null;
      status: SessionStatus;
      userId: string;
    },
    hashMatches: boolean,
    metadata: RequestMetadata,
    now: Date,
  ): Promise<never> {
    if (
      classifyRefreshFailure(session, hashMatches, now) === 'CONCURRENT_REFRESH'
    ) {
      await this.audit(
        session.userId,
        'auth.refresh.concurrent',
        'Session',
        session.id,
        AuditOutcome.FAILURE,
        metadata,
        { reason: 'concurrent-browser-refresh' },
      );
      throw new ConflictException({
        code: 'AUTH_REFRESH_CONCURRENT',
        message: 'نشست در حال تازه‌سازی است.',
      });
    }
    await this.revokeFamily(session.familyId, 'refresh-token-reuse');
    await this.audit(
      session.userId,
      'auth.refresh.reuse',
      'Session',
      session.id,
      AuditOutcome.FAILURE,
      metadata,
    );
    throw new UnauthorizedException('نشست معتبر نیست.');
  }

  private issueAccessToken(userId: string, sessionId: string) {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId, type: 'access' } satisfies AccessClaims,
      { expiresIn: ACCESS_TTL_SECONDS },
    );
  }
  private assertMfaNotLocked(lockedUntil: Date | null): void {
    if (lockedUntil && lockedUntil > new Date())
      throw new HttpException(
        {
          code: 'IAM_MFA_RATE_LIMITED',
          message:
            'تلاش‌های ناموفق بیش از حد است؛ چند دقیقه بعد دوباره تلاش کنید.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
  }
  private async recordMfaFailure(
    user: {
      id: string;
      mfaFailedAttempts: number;
      mfaLockedUntil: Date | null;
    },
    action: string,
    metadata: RequestMetadata,
  ): Promise<void> {
    const failures = user.mfaFailedAttempts + 1;
    const lockedUntil =
      failures >= MFA_MAX_ATTEMPTS
        ? new Date(Date.now() + MFA_LOCK_MINUTES * 60_000)
        : null;
    await this.database.client.user.update({
      where: { id: user.id },
      data: {
        mfaFailedAttempts: failures,
        mfaLockedUntil: lockedUntil,
      },
    });
    await this.audit(
      user.id,
      action,
      'User',
      user.id,
      AuditOutcome.FAILURE,
      metadata,
      {
        reason: lockedUntil ? 'rate-limited' : 'invalid-verification',
      },
    );
  }
  private tokenHash(value: string) {
    return createHash('sha256').update(value, 'utf8').digest('hex');
  }
  private accessRevision(user: {
    roles: Array<{
      role: {
        id: string;
        isActive: boolean;
        permissions: Array<{ permission: { id: string; code: string } }>;
      };
    }>;
    branches: Array<{ branch: { id: string } }>;
  }) {
    const snapshot = {
      roles: user.roles
        .map(({ role }) => ({
          id: role.id,
          isActive: role.isActive,
          permissions: role.permissions
            .map(({ permission }) => `${permission.id}:${permission.code}`)
            .sort(),
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      branches: user.branches.map(({ branch }) => branch.id).sort(),
    };
    return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
  }

  private canDelegateControl(
    actor: AuthenticatedActor,
    controlId: string,
    group?: string,
  ) {
    if (controlId.startsWith('master-data.resource.'))
      return canUseMasterDataResource(
        actor.permissions,
        controlId.slice('master-data.resource.'.length),
      );
    if (!controlId.startsWith('field.'))
      return canViewScreen(actor.permissions, controlId);
    if (!hasAccessControl(actor.permissions, controlId)) return false;
    if (group === 'master-data') {
      const suffix = controlId.slice('field.master-data.'.length);
      const resource = suffix.slice(0, suffix.lastIndexOf('.'));
      return (
        canUseMasterDataResource(actor.permissions, resource) &&
        actor.permissions.some((code) =>
          ['master_data.create', 'master_data.update'].includes(code),
        )
      );
    }
    if (group === 'customers')
      return (
        canViewScreen(actor.permissions, 'customers.home') &&
        actor.permissions.some((code) =>
          ['customers.create', 'customers.update'].includes(code),
        )
      );
    if (group === 'system') {
      const [namespace] = controlId
        .slice('field.system-settings.'.length)
        .split('.');
      return (
        actor.permissions.includes('system.settings.manage') &&
        canViewScreen(actor.permissions, `system.module.${namespace}`)
      );
    }
    return false;
  }
  private async managedAccess(
    dto: {
      accessTitle?: string;
      permissionIds?: string[];
      screenIds?: string[];
      deniedControlIds?: string[];
      roleIds?: string[];
      manualAccessV3?: boolean;
    },
    actor: AuthenticatedActor,
    deferRestrictionDelegation = false,
  ) {
    if (
      dto.accessTitle === undefined &&
      dto.permissionIds === undefined &&
      dto.screenIds === undefined &&
      dto.deniedControlIds === undefined
    )
      return null;
    if (
      dto.accessTitle === undefined &&
      dto.permissionIds === undefined &&
      dto.screenIds === undefined
    ) {
      const deniedControlIds = dto.deniedControlIds ?? [];
      const isAdministrator = await this.isSystemAdministrator(actor);
      for (const id of deniedControlIds) {
        const control = USER_ACCESS_DENY_CONTROLS.find(
          (item) => item.id === id,
        );
        if (!control || !isUserAccessControlId(id))
          throw new BadRequestException('محدودیت انتخاب‌شده معتبر نیست.');
        if (
          !isAdministrator &&
          !deferRestrictionDelegation &&
          !this.canDelegateControl(actor, id, control.group)
        )
          throw new ForbiddenException(
            'تغییر محدودیت خارج از دسترسی خودتان مجاز نیست.',
          );
      }
      return {
        title: 'محدودیت‌های اختصاصی',
        permissionIds: [],
        permissionCodes: [],
        screenIds: [],
        deniedControlIds,
        managed: false,
        canAssignAll: isAdministrator,
      };
    }
    if (
      !dto.accessTitle ||
      (!dto.manualAccessV3 &&
        !USER_JOB_TITLES.includes(
          dto.accessTitle as (typeof USER_JOB_TITLES)[number],
        )) ||
      !dto.accessTitle.trim() ||
      dto.accessTitle.length > 80 ||
      !Array.isArray(dto.permissionIds) ||
      !Array.isArray(dto.screenIds) ||
      (dto.roleIds?.length ?? 0)
    )
      throw new BadRequestException(
        'نقش، مجوزها و بخش‌های قابل مشاهده را کامل انتخاب کنید.',
      );
    const permissionIds = [...dto.permissionIds];
    if (!dto.manualAccessV3 && dto.screenIds.includes('sales.new-contract')) {
      const masterDataRead = await this.database.client.permission.findUnique({
        where: { code: 'master_data.read' },
        select: { id: true },
      });
      if (masterDataRead && !permissionIds.includes(masterDataRead.id))
        permissionIds.push(masterDataRead.id);
    }
    const isAdministrator = await this.isSystemAdministrator(actor);
    if (!isAdministrator) {
      this.assertPermissionCodesAssignable(
        salesManagerRolePermissions([
          { role: { name: dto.accessTitle, isActive: true } },
        ]),
        actor,
      );
      await this.assertPermissionsAssignable(permissionIds, actor);
    }
    const permissions = await this.database.client.permission.findMany({
      where: { id: { in: permissionIds } },
      select: { code: true },
    });
    if (permissions.length !== new Set(permissionIds).size)
      throw new BadRequestException('مجوز انتخاب‌شده وجود ندارد.');
    if (permissions.some((p) => p.code.startsWith('ui.')))
      throw new BadRequestException(
        'مجوز نمایشی از کاتالوگ بخش‌ها انتخاب می‌شود.',
      );
    const completed = dto.manualAccessV3
      ? completeManualAccessPrerequisites({
          permissionCodes: permissions.map(({ code }) => code),
          screenIds: dto.screenIds,
          allowedControlIds: [],
        })
      : {
          permissionCodes: permissions.map(({ code }) => code),
          screenIds: dto.screenIds,
        };
    if (!isAdministrator)
      this.assertPermissionCodesAssignable(completed.permissionCodes, actor);
    for (const id of completed.screenIds) {
      if (!USER_ACCESS_SCREENS.some((s) => s.id === id))
        throw new BadRequestException('زیربخش انتخاب‌شده معتبر نیست.');
      if (
        !isAdministrator &&
        hasManagedAccess(actor.permissions) &&
        !actor.permissions.includes(screenPermission(id))
      )
        throw new ForbiddenException(
          'واگذاری بخش خارج از دسترسی خودتان مجاز نیست.',
        );
    }
    const deniedControlIds = dto.deniedControlIds;
    if (dto.manualAccessV3 && !isAdministrator) {
      for (const control of USER_ACCESS_DENY_CONTROLS) {
        if (
          !(deniedControlIds ?? []).includes(control.id) &&
          !this.canDelegateControl(actor, control.id, control.group)
        )
          throw new ForbiddenException(
            'تغییر محدودیت خارج از دسترسی خودتان مجاز نیست.',
          );
      }
    }
    for (const id of deniedControlIds ?? []) {
      const control = USER_ACCESS_DENY_CONTROLS.find((item) => item.id === id);
      if (!control || !isUserAccessControlId(id))
        throw new BadRequestException('محدودیت انتخاب‌شده معتبر نیست.');
      if (
        !isAdministrator &&
        !deferRestrictionDelegation &&
        !dto.manualAccessV3 &&
        !this.canDelegateControl(actor, id, control.group)
      )
        throw new ForbiddenException(
          'تغییر محدودیت خارج از دسترسی خودتان مجاز نیست.',
        );
    }
    return {
      title: dto.accessTitle,
      permissionIds,
      permissionCodes: completed.permissionCodes,
      screenIds: completed.screenIds,
      deniedControlIds,
      managed: true,
      canAssignAll: isAdministrator,
    };
  }
  private async personalAccessRole(
    transaction: Pick<
      DatabaseService['client'],
      'permission' | 'role' | 'rolePermission'
    >,
    userId: string,
    profile: {
      title: string;
      permissionIds: string[];
      permissionCodes: string[];
      screenIds: string[];
      deniedControlIds: string[];
      managed: boolean;
      canAssignAll: boolean;
    },
    actor: AuthenticatedActor,
  ) {
    const viewIds: string[] = [];
    for (const code of [
      ...(profile.managed
        ? [
            USER_ACCESS_PROFILE_PERMISSION,
            ...profile.screenIds.map(screenPermission),
          ]
        : []),
      ...profile.deniedControlIds.map(denyPermission),
    ]) {
      const screen = USER_ACCESS_SCREENS.find(
        (s) => screenPermission(s.id) === code,
      );
      const control = USER_ACCESS_DENY_CONTROLS.find(
        ({ id }) => denyPermission(id) === code,
      );
      const permission = await transaction.permission.upsert({
        where: { code },
        create: {
          code,
          module: 'iam-ui',
          name: control?.title ?? screen?.title ?? 'دسترسی مستقل کاربر',
        },
        update: {},
        select: { id: true },
      });
      viewIds.push(permission.id);
    }
    const role = await transaction.role.upsert({
      where: { code: 'personal-access-' + userId },
      create: {
        code: 'personal-access-' + userId,
        name: profile.title,
        isActive: true,
      },
      update: { name: profile.title, isActive: true },
      select: {
        id: true,
        permissions: {
          select: {
            permissionId: true,
            permission: { select: { code: true } },
          },
        },
        users: { select: { userId: true } },
      },
    });
    if (
      (role.users ?? []).some(
        ({ userId: assignedUserId }) => assignedUserId !== userId,
      )
    )
      throw new ConflictException({
        code: 'IAM_PERSONAL_ROLE_OWNERSHIP',
        message: 'نقش اختصاصی به حساب دیگری متصل است و قابل بازنویسی نیست.',
      });
    const desiredCodes = new Set<string>([
      ...(profile.managed
        ? [
            USER_ACCESS_PROFILE_PERMISSION,
            ...profile.screenIds.map(screenPermission),
          ]
        : []),
      ...profile.deniedControlIds.map(denyPermission),
    ]);
    const previousCodes = (role.permissions ?? []).map(
      ({ permission }) => permission.code,
    );
    if (
      mustScopeCallCenter(
        {
          permissionCodes: previousCodes,
          screenIds: canViewRoute(
            previousCodes,
            '/customer-affairs/call-center',
          )
            ? ['customer-affairs.call-center']
            : [],
        },
        profile,
      )
    ) {
      const flag = await transaction.permission.upsert({
        where: { code: CALL_CENTER_SCOPED_ACCESS },
        create: {
          code: CALL_CENTER_SCOPED_ACCESS,
          module: 'customer_affairs',
          name: 'محدوده امن کال سنتر نسخه ۱',
        },
        update: {},
        select: { id: true },
      });
      viewIds.push(flag.id);
      desiredCodes.add(CALL_CENTER_SCOPED_ACCESS);
    }
    const preservedIds: string[] = [];
    for (const grant of role.permissions ?? []) {
      const code = grant.permission.code;
      if (desiredCodes.has(code)) continue;
      if (!profile.managed && !code.startsWith('ui.deny.')) {
        preservedIds.push(grant.permissionId);
        continue;
      }
      if (code.startsWith('ui.deny.')) {
        const controlId = code.slice('ui.deny.'.length);
        const control = USER_ACCESS_DENY_CONTROLS.find(
          (item) => item.id === controlId,
        );
        if (
          !control ||
          (!profile.canAssignAll &&
            !this.canDelegateControl(actor, controlId, control.group))
        ) {
          preservedIds.push(grant.permissionId);
          if (control)
            throw new ForbiddenException(
              'برداشتن این محدودیت خارج از اختیار واگذاری شما است.',
            );
        }
        continue;
      }
      if (
        code.startsWith('ui.screen.') &&
        (!USER_ACCESS_SCREENS.some(({ id }) => screenPermission(id) === code) ||
          (!profile.canAssignAll &&
            !canViewScreen(actor.permissions, code.slice('ui.screen.'.length))))
      ) {
        preservedIds.push(grant.permissionId);
        continue;
      }
      if (
        code.startsWith('ui.') &&
        code !== USER_ACCESS_PROFILE_PERMISSION &&
        !code.startsWith('ui.screen.')
      ) {
        preservedIds.push(grant.permissionId);
        continue;
      }
      if (
        !code.startsWith('ui.') &&
        !(IAM_PERMISSION_CODES as readonly string[]).includes(code)
      ) {
        preservedIds.push(grant.permissionId);
        continue;
      }
      if (
        !code.startsWith('ui.') &&
        !profile.canAssignAll &&
        !actor.permissions.includes(code as IamPermissionCode)
      )
        preservedIds.push(grant.permissionId);
    }
    await transaction.rolePermission.deleteMany({ where: { roleId: role.id } });
    await transaction.rolePermission.createMany({
      data: [
        ...new Set([...profile.permissionIds, ...viewIds, ...preservedIds]),
      ].map((permissionId) => ({ roleId: role.id, permissionId })),
    });
    return role.id;
  }

  private async assertRolesAssignable(
    roleIds: readonly string[],
    actor: AuthenticatedActor,
  ) {
    const roles = await this.database.client.role.findMany({
      where: { id: { in: [...roleIds] }, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        permissions: { select: { permission: { select: { code: true } } } },
      },
    });
    if (roles.length !== new Set(roleIds).size)
      throw new BadRequestException('یک یا چند نقش معتبر یا فعال نیست.');
    if (
      roles.some(
        (role) =>
          role.code?.startsWith('personal-access-') ||
          role.code?.startsWith(MANUAL_ACCESS_ROLE_PREFIX),
      )
    )
      throw new BadRequestException(
        'نقش اختصاصی یک کاربر به کاربر دیگر واگذار نمی‌شود.',
      );
    const permissionCodes = roles.flatMap((role) =>
      role.permissions.map(({ permission }) => permission.code),
    );
    this.assertPermissionCodesAssignable(
      [
        ...permissionCodes,
        ...salesManagerRolePermissions(
          roles.map((role) => ({ role: { ...role, isActive: true } })),
        ),
      ],
      actor,
    );
  }
  private async assertPermissionsAssignable(
    permissionIds: readonly string[],
    actor: AuthenticatedActor,
  ) {
    const permissions = await this.database.client.permission.findMany({
      where: { id: { in: [...permissionIds] } },
      select: { id: true, code: true },
    });
    if (permissions.length !== new Set(permissionIds).size)
      throw new BadRequestException('یک یا چند مجوز معتبر نیست.');
    this.assertPermissionCodesAssignable(
      permissions.map(({ code }) => code),
      actor,
    );
    return permissions.map(({ code }) => code);
  }
  private async isSystemAdministrator(actor: AuthenticatedActor) {
    const user = await this.database.client.user.findUnique({
      where: { id: actor.userId },
      select: {
        roles: {
          where: { role: { isActive: true } },
          select: { role: { select: { code: true } } },
        },
      },
    });
    return Boolean(
      user?.roles.some(({ role }) => role.code === 'administrator'),
    );
  }
  private assertPermissionCodesAssignable(
    permissionCodes: readonly string[],
    actor: AuthenticatedActor,
  ) {
    if (
      hasScopedCallCenterAccess(actor.permissions) &&
      permissionCodes.some((code) =>
        code.startsWith('customer_affairs.call_center.'),
      ) &&
      !hasScopedCallCenterAccess(permissionCodes)
    )
      throw new ForbiddenException(
        'واگذاری دسترسی قدیمی و بدون محدوده کال سنتر از اختیار شما خارج است.',
      );
    const actorPermissions = new Set<string>(actor.permissions);
    if (permissionCodes.some((code) => !actorPermissions.has(code)))
      throw new ForbiddenException(
        'واگذاری مجوزی که خود کاربر جاری ندارد مجاز نیست.',
      );
  }
  private validAdministrativeReason(value: string) {
    if (!isOptionalOperationReason(value, 120))
      throw new BadRequestException('دلیل باید متن حداکثر ۱۲۰ نویسه باشد.');
    return (value ?? '').trim();
  }
  private maskIp(value: string | null) {
    if (!value) return null;
    if (value.includes(':'))
      return `${value.split(':').slice(0, 3).join(':')}:*`;
    const parts = value.split('.');
    return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : 'masked';
  }
  private summarizeUserAgent(value: string | null) {
    if (!value) return null;
    return (
      value
        .replace(/[\r\n\t]+/g, ' ')
        .trim()
        .slice(0, 160) || null
    );
  }
  private revokeFamily(familyId: string, reason: string) {
    return this.database.client.session.updateMany({
      where: { familyId, status: SessionStatus.ACTIVE },
      data: {
        status: SessionStatus.REVOKED,
        revokedAt: new Date(),
        revokedReason: reason,
      },
    });
  }
  private userAccessInclude() {
    return {
      roles: {
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      },
      branches: { include: { branch: true } },
    } as const;
  }
  private permissionCodes(user: {
    roles: Array<{
      role: {
        isActive: boolean;
        permissions: Array<{ permission: { code: string } }>;
      };
    }>;
  }): IamPermissionCode[] {
    return authenticatedPermissionCodes(user.roles);
  }
  private loginResponse(user: {
    id: string;
    username: string;
    email: string | null;
    displayName: string;
    roles: Array<{
      role: {
        code: string;
        name: string;
        isActive: boolean;
        permissions: Array<{ permission: { code: string } }>;
      };
    }>;
    branches: Array<{ branch: { id: string; code: string; name: string } }>;
  }): LoginResponse {
    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        permissions: this.permissionCodes(user),
        branches: user.branches.map(({ branch }) => branch),
        roles: user.roles
          .filter(({ role }) => role.isActive)
          .map(({ role }) => ({ code: role.code, name: role.name })),
      },
    };
  }
  /** Trusted Reservations boundary: only responsibility metadata for an authorized intake. */
  async reservationResponsibilityNames(
    ids: readonly string[],
    branchId: string,
    actor: AuthenticatedActor,
  ) {
    if (
      !actor.permissions.includes('reservations.read') ||
      !actor.branchIds.includes(branchId)
    )
      throw new ForbiddenException();
    const unique = [...new Set(ids)].slice(0, 3);
    if (!unique.length) return new Map<string, string>();
    const users = await this.database.client.user.findMany({
      where: { id: { in: unique } },
      select: { id: true, displayName: true },
    });
    return new Map(users.map((user) => [user.id, user.displayName]));
  }
  async recordReservationOperation(
    intakeId: string,
    branchId: string,
    actor: AuthenticatedActor,
    operation: string,
  ) {
    if (!actor.branchIds.includes(branchId)) throw new ForbiddenException();
    await this.database.client.auditEvent.create({
      data: {
        actorUserId: actor.userId,
        action: operation.slice(0, 120),
        entityType: 'reservation_operation',
        entityId: intakeId,
        outcome: 'SUCCESS',
        metadata: { branchId },
      },
    });
  }
  async latestReservationOperation(
    intakeId: string,
    branchId: string,
    actor: AuthenticatedActor,
  ) {
    if (
      !actor.permissions.includes('reservations.read') ||
      !actor.branchIds.includes(branchId)
    )
      throw new ForbiddenException();
    return this.database.client.auditEvent.findFirst({
      where: {
        entityType: 'reservation_operation',
        entityId: intakeId,
        outcome: 'SUCCESS',
        metadata: { path: ['branchId'], equals: branchId },
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      select: { actorUserId: true, occurredAt: true },
    });
  }

  private audit(
    actorUserId: string | null,
    action: string,
    entityType: string,
    entityId: string | undefined,
    outcome: AuditOutcome,
    metadata: RequestMetadata,
    details?: Record<string, string>,
  ) {
    return this.database.client.auditEvent.create({
      data: {
        actorUserId,
        action,
        entityType,
        entityId: entityId ?? null,
        outcome,
        ...(details ? { metadata: details } : {}),
        ...metadata,
      },
    });
  }
}
