import {
  BadRequestException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';
import {
  AuditOutcome,
  SessionStatus,
  UserStatus,
  type DatabaseClient,
  type Prisma,
} from '@rubi/database';
import { hash, verify } from 'argon2';
import { LOCK_MINUTES, MAX_LOGIN_ATTEMPTS } from './iam.constants';
import { passwordPolicyErrors } from './password-policy';
import type { RequestMetadata } from './iam.types';

// Shared order: user row, then session rows. Login/refresh use this same lock so
// an old credential cannot create a session after password-change revocation.
export async function lockIamUser(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.$queryRaw`SELECT id FROM iam_users WHERE id = ${userId}::uuid FOR UPDATE`;
}

export async function changeIamPassword(
  database: DatabaseClient,
  actor: AuthenticatedActor,
  currentPassword: string,
  newPassword: string,
  metadata: RequestMetadata,
): Promise<void> {
  if (!actor.sessionId) throw new UnauthorizedException();
  if (
    typeof currentPassword !== 'string' ||
    !currentPassword.length ||
    currentPassword.length > 200 ||
    typeof newPassword !== 'string' ||
    newPassword.length > 200 ||
    passwordPolicyErrors(newPassword).length
  ) {
    throw new BadRequestException({
      code: 'IAM_PASSWORD_POLICY',
      message:
        'رمز جدید باید ۱۰ تا ۲۰۰ نویسه و شامل حرف بزرگ و کوچک لاتین، عدد و نویسه ویژه باشد.',
    });
  }
  if (currentPassword === newPassword)
    throw new BadRequestException({
      code: 'IAM_PASSWORD_UNCHANGED',
      message: 'رمز جدید باید با رمز فعلی متفاوت باشد.',
    });

  const result = await database.$transaction(
    async (tx) => {
      await lockIamUser(tx, actor.userId);
      const user = await tx.user.findUnique({ where: { id: actor.userId } });
      const now = new Date();
      if (!user || user.status !== UserStatus.ACTIVE)
        throw new UnauthorizedException();
      if (user.lockedUntil && user.lockedUntil > now) return 'locked';
      const session = await tx.session.findFirst({
        where: {
          id: actor.sessionId,
          userId: actor.userId,
          status: SessionStatus.ACTIVE,
          expiresAt: { gt: now },
        },
      });
      if (!session) throw new UnauthorizedException();
      if (
        !(await verify(user.passwordHash, currentPassword).catch(() => false))
      ) {
        const failures = user.failedLoginAttempts + 1;
        const locked = failures >= MAX_LOGIN_ATTEMPTS;
        await tx.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: failures,
            lockedUntil: locked
              ? new Date(now.getTime() + LOCK_MINUTES * 60_000)
              : null,
          },
        });
        await tx.auditEvent.create({
          data: {
            actorUserId: user.id,
            action: 'auth.password.change',
            entityType: 'User',
            entityId: user.id,
            outcome: AuditOutcome.FAILURE,
            ...metadata,
          },
        });
        return locked ? 'locked' : 'invalid';
      }
      const passwordHash = await hash(newPassword, {
        type: 2,
        memoryCost: 65_536,
        timeCost: 3,
        parallelism: 1,
      });
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordChangedAt: now,
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
      await tx.session.updateMany({
        where: {
          userId: user.id,
          status: { in: [SessionStatus.ACTIVE, SessionStatus.ROTATED] },
        },
        data: {
          status: SessionStatus.REVOKED,
          revokedAt: now,
          revokedReason: 'password-changed',
        },
      });
      await tx.auditEvent.create({
        data: {
          actorUserId: user.id,
          action: 'auth.password.change',
          entityType: 'User',
          entityId: user.id,
          outcome: AuditOutcome.SUCCESS,
          ...metadata,
        },
      });
      return 'changed';
    },
    { timeout: 10000 },
  );
  // Throw after committing failed-attempt accounting.
  if (result === 'locked')
    throw new HttpException(
      {
        code: 'IAM_PASSWORD_LOCKED',
        message:
          'تلاش‌های ناموفق بیش از حد است. ۱۵ دقیقه دیگر دوباره تلاش کنید.',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  if (result === 'invalid')
    throw new BadRequestException({
      code: 'IAM_PASSWORD_CURRENT_INVALID',
      message: 'رمز عبور فعلی صحیح نیست.',
    });
}
