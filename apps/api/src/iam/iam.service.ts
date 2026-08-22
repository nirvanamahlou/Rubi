import {
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthenticatedActor,
  IamPermissionCode,
  LoginResponse,
} from '@rubi/contracts';
import { AuditOutcome, SessionStatus, UserStatus } from '@rubi/database';
import { hash, verify } from 'argon2';

import { DatabaseService } from '../database/database.service';
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
import type { RequestMetadata } from './iam.types';

interface AccessClaims {
  sub: string;
  sid: string;
  type: 'access';
}

@Injectable()
export class IamService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async login(emailInput: string, password: string, metadata: RequestMetadata) {
    const email = emailInput.trim().toLowerCase();
    const user = await this.database.client.user.findUnique({
      where: { email },
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
        const failures = user.failedLoginAttempts + 1;
        await this.database.client.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: failures,
            lockedUntil:
              failures >= MAX_LOGIN_ATTEMPTS
                ? new Date(now.getTime() + LOCK_MINUTES * 60_000)
                : null,
            status:
              failures >= MAX_LOGIN_ATTEMPTS ? UserStatus.LOCKED : user.status,
          },
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
      throw new UnauthorizedException('ایمیل یا رمز عبور صحیح نیست.');
    }

    const sessionId = randomUUID();
    const familyId = randomUUID();
    const refreshSecret = randomBytes(48).toString('base64url');
    const expiresAt = new Date(now.getTime() + REFRESH_TTL_DAYS * 86_400_000);
    await this.database.client.$transaction([
      this.database.client.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
          status: UserStatus.ACTIVE,
          lastLoginAt: now,
        },
      }),
      this.database.client.session.create({
        data: {
          id: sessionId,
          familyId,
          userId: user.id,
          refreshTokenHash: this.tokenHash(refreshSecret),
          expiresAt,
          ...metadata,
        },
      }),
      this.database.client.auditEvent.create({
        data: {
          actorUserId: user.id,
          action: 'auth.login',
          entityType: 'Session',
          entityId: sessionId,
          outcome: AuditOutcome.SUCCESS,
          ...metadata,
        },
      }),
    ]);
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
    const supplied = Buffer.from(this.tokenHash(secret), 'hex');
    const stored = Buffer.from(session.refreshTokenHash, 'hex');
    const hashMatches =
      supplied.length === stored.length && timingSafeEqual(supplied, stored);
    if (session.status !== SessionStatus.ACTIVE || !hashMatches) {
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
    if (
      session.expiresAt <= new Date() ||
      session.user.status !== UserStatus.ACTIVE
    ) {
      await this.revokeFamily(session.familyId, 'expired-or-disabled');
      throw new UnauthorizedException('نشست منقضی شده است.');
    }
    const nextId = randomUUID();
    const nextSecret = randomBytes(48).toString('base64url');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);
    await this.database.client.$transaction([
      this.database.client.session.update({
        where: { id: session.id },
        data: {
          status: SessionStatus.ROTATED,
          revokedAt: new Date(),
          revokedReason: 'rotated',
          lastUsedAt: new Date(),
        },
      }),
      this.database.client.session.create({
        data: {
          id: nextId,
          familyId: session.familyId,
          userId: session.userId,
          refreshTokenHash: this.tokenHash(nextSecret),
          expiresAt,
          ...metadata,
        },
      }),
    ]);
    return {
      accessToken: await this.issueAccessToken(session.userId, nextId),
      refreshToken: `${nextId}.${nextSecret}`,
      expiresAt,
      body: this.loginResponse(session.user),
    };
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
    ]).then(([roles, branches]) => ({ roles, branches }));
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
    const email = dto.email.trim().toLowerCase();
    const exists = await this.database.client.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (exists) throw new ConflictException('کاربری با این ایمیل وجود دارد.');
    const passwordHash = await hash(dto.password, {
      type: 2,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
    const user = await this.database.client.user.create({
      data: {
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
      select: { id: true, email: true, displayName: true, status: true },
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
    emailInput: string,
    password: string,
    displayName: string,
  ): Promise<string> {
    assertStrongPassword(password);
    const email = emailInput.trim().toLowerCase();
    const [role, branch] = await Promise.all([
      this.database.client.role.findUniqueOrThrow({
        where: { code: 'administrator' },
      }),
      this.database.client.branch.findUniqueOrThrow({ where: { code: 'HQ' } }),
    ]);
    const passwordHash = await hash(password, {
      type: 2,
      memoryCost: 65_536,
      timeCost: 3,
      parallelism: 1,
    });
    const user = await this.database.client.user.upsert({
      where: { email },
      create: { email, displayName, passwordHash },
      update: {
        displayName,
        passwordHash,
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
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
    );
    return user.id;
  }

  private issueAccessToken(userId: string, sessionId: string) {
    return this.jwt.signAsync(
      { sub: userId, sid: sessionId, type: 'access' } satisfies AccessClaims,
      { expiresIn: ACCESS_TTL_SECONDS },
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
    return [
      ...new Set(
        user.roles
          .filter(({ role }) => role.isActive)
          .flatMap(({ role }) =>
            role.permissions.map(
              ({ permission }) => permission.code as IamPermissionCode,
            ),
          ),
      ),
    ];
  }
  private loginResponse(user: {
    id: string;
    email: string;
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
