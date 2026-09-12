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
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthenticatedActor,
  IamPermissionCode,
  LoginResponse,
  MessagingContactV1,
} from '@rubi/contracts';
import { AuditOutcome, SessionStatus, UserStatus } from '@rubi/database';
import { hash, verify } from 'argon2';

import { DatabaseService } from '../database/database.service';
import { authenticatedPermissionCodes } from './authenticated-permissions';
import {
  ACCESS_TTL_SECONDS,
  LOCK_MINUTES,
  MAX_LOGIN_ATTEMPTS,
  REFRESH_TTL_DAYS,
} from './iam.constants';
import type { CreateUserDto } from './dto/create-user.dto';
import type { CreateRoleDto } from './dto/create-role.dto';
import type { UpdateUserAccessDto } from './dto/update-user-access.dto';
import { assertStrongPassword } from './password-policy';
import { classifyRefreshFailure } from './refresh-token-policy';
import type { RequestMetadata } from './iam.types';
import type { IamStepUpPort } from './iam-step-up.port';
import { MfaTotpService } from './mfa-totp';
import { changeIamPassword, lockIamUser } from './password-change';

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
    const session = await this.database.client.session.findFirst({
      where: {
        id: claims.sid,
        userId: claims.sub,
        status: SessionStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      include: { user: { include: this.userAccessInclude() } },
    });
    if (!session || session.user.status !== UserStatus.ACTIVE)
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

  listUsers() {
    return this.database.client.user.findMany({
      orderBy: { displayName: 'asc' },
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        status: true,
        lastLoginAt: true,
        roles: {
          select: { role: { select: { id: true, code: true, name: true } } },
        },
        branches: {
          select: { branch: { select: { id: true, code: true, name: true } } },
        },
      },
    });
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

  listRolesAndBranches() {
    return Promise.all([
      this.database.client.role.findMany({
        where: { isActive: true },
        include: { permissions: { include: { permission: true } } },
        orderBy: { name: 'asc' },
      }),
      this.database.client.branch.findMany({
        where: { isActive: true },
        orderBy: { name: 'asc' },
      }),
      this.database.client.permission.findMany({
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

  async createRole(
    dto: CreateRoleDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    const role = await this.database.client.role.create({
      data: {
        code: dto.code,
        name: dto.name.trim(),
        permissions: {
          create: dto.permissionIds.map((permissionId) => ({ permissionId })),
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

  async createUser(
    dto: CreateUserDto,
    actor: AuthenticatedActor,
    metadata: RequestMetadata,
  ) {
    assertStrongPassword(dto.password);
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
    const user = await this.database.client.user.create({
      data: {
        username,
        email,
        displayName: dto.displayName.trim(),
        passwordHash,
        roles: { create: dto.roleIds.map((roleId) => ({ roleId })) },
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
    await this.database.client.$transaction(async (transaction) => {
      await transaction.userRole.deleteMany({ where: { userId } });
      await transaction.userBranch.deleteMany({ where: { userId } });
      if (dto.roleIds.length)
        await transaction.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId, roleId })),
        });
      if (dto.branchIds.length)
        await transaction.userBranch.createMany({
          data: dto.branchIds.map((branchId, index) => ({
            userId,
            branchId,
            isPrimary: index === 0,
          })),
        });
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
    const user = await this.database.client.user.update({
      where: { id: userId },
      data: { status, failedLoginAttempts: 0, lockedUntil: null },
      select: { id: true, status: true },
    });
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
      },
    };
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
