import {
  GoneException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';
import type {
  AuthenticatedActor,
  B2bPhoneVerificationRole,
} from '@nora/contracts';

const CHALLENGE_TTL_MS = 5 * 60_000;
const GRANT_TTL_MS = 5 * 60_000;
const RATE_WINDOW_MS = 60 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ACTOR_SENDS = 20;
const MAX_PHONE_SENDS = 5;
const MAX_ATTEMPTS = 5;
const MAX_SECURITY_ENTRIES = 1_000;

export interface PhoneVerificationBinding {
  actor: AuthenticatedActor;
  branchId: string;
  registrationId: string;
  role: B2bPhoneVerificationRole;
  organizationId: string | null;
  canonicalPhone: string;
}

interface StoredBinding {
  actorUserId: string;
  sessionId: string;
  branchId: string;
  registrationId: string;
  role: B2bPhoneVerificationRole;
  organizationId: string | null;
  canonicalPhone: string;
}

interface Challenge extends StoredBinding {
  id: string;
  codeDigest: Buffer;
  salt: Buffer;
  attempts: number;
  expiresAt: number;
}

interface Grant extends StoredBinding {
  digest: string;
  issuedAt: number;
  expiresAt: number;
}

export interface InspectedPhoneGrant {
  organizationId: string | null;
  issuedAt: number;
  expiresAt: number;
  canonicalPhone: string;
}

function developmentOnly() {
  if (process.env.NODE_ENV !== 'development')
    throw new ServiceUnavailableException(
      'تأیید شماره در این محیط غیرفعال است و پرونده ذخیره نشد.',
    );
}

function stored(binding: PhoneVerificationBinding): StoredBinding {
  return {
    actorUserId: binding.actor.userId,
    sessionId: binding.actor.sessionId,
    branchId: binding.branchId,
    registrationId: binding.registrationId,
    role: binding.role,
    organizationId: binding.organizationId,
    canonicalPhone: binding.canonicalPhone,
  };
}

function sameCore(left: StoredBinding, right: PhoneVerificationBinding) {
  return (
    left.actorUserId === right.actor.userId &&
    left.sessionId === right.actor.sessionId &&
    left.branchId === right.branchId &&
    left.registrationId === right.registrationId &&
    left.role === right.role &&
    left.canonicalPhone === right.canonicalPhone
  );
}

function digest(value: string, salt?: Buffer) {
  return createHash('sha256')
    .update(salt ?? Buffer.alloc(0))
    .update(value, 'utf8')
    .digest();
}

@Injectable()
export class B2bPhoneVerificationStore {
  private readonly challenges = new Map<string, Challenge>();
  private readonly grants = new Map<string, Grant>();
  private readonly actorSends = new Map<string, number[]>();
  private readonly phoneSends = new Map<string, number[]>();

  issue(binding: PhoneVerificationBinding) {
    developmentOnly();
    const now = Date.now();
    this.cleanup(now);
    const actorHistory = this.actorSends.get(binding.actor.userId) ?? [];
    const phoneHistory = this.phoneSends.get(binding.canonicalPhone) ?? [];
    if (actorHistory.length >= MAX_ACTOR_SENDS)
      throw new HttpException(
        'سقف ارسال کد برای این کاربر در یک ساعت تکمیل شده است.',
        429,
      );
    if (phoneHistory.length >= MAX_PHONE_SENDS)
      throw new HttpException(
        'سقف ارسال کد برای این شماره در یک ساعت تکمیل شده است.',
        429,
      );
    const lastPhoneSend = phoneHistory.at(-1);
    if (lastPhoneSend !== undefined && now - lastPhoneSend < RESEND_COOLDOWN_MS)
      throw new HttpException(
        `برای ارسال دوباره ${Math.ceil((RESEND_COOLDOWN_MS - (now - lastPhoneSend)) / 1_000)} ثانیه صبر کنید.`,
        429,
      );

    const replaceable = this.registrationEntryCount(binding);
    const additionalLedgerEntries =
      (this.actorSends.has(binding.actor.userId) ? 0 : 1) +
      (this.phoneSends.has(binding.canonicalPhone) ? 0 : 1);
    if (
      this.securityEntryCount() - replaceable + 1 + additionalLedgerEntries >
      MAX_SECURITY_ENTRIES
    )
      throw new ServiceUnavailableException(
        'ظرفیت امن سرویس تأیید تکمیل است؛ بعداً دوباره تلاش کنید.',
      );

    this.invalidateRegistration(binding);
    const id = randomUUID();
    const code = randomInt(100_000, 1_000_000).toString();
    const salt = randomBytes(16);
    const expiresAt = now + CHALLENGE_TTL_MS;
    this.challenges.set(id, {
      id,
      ...stored(binding),
      codeDigest: digest(code, salt),
      salt,
      attempts: 0,
      expiresAt,
    });
    this.actorSends.set(binding.actor.userId, [...actorHistory, now]);
    this.phoneSends.set(binding.canonicalPhone, [...phoneHistory, now]);
    return {
      challengeId: id,
      code,
      expiresAt,
      resendAfter: now + RESEND_COOLDOWN_MS,
    };
  }

  verify(challengeId: string, code: string, binding: PhoneVerificationBinding) {
    developmentOnly();
    const now = Date.now();
    this.cleanup(now);
    const challenge = this.challenges.get(challengeId);
    if (!challenge || !sameCore(challenge, binding))
      throw new UnauthorizedException('کد برای این درخواست معتبر نیست.');
    if (challenge.organizationId !== binding.organizationId)
      throw new UnauthorizedException('کد برای این سازمان صادر نشده است.');
    if (now >= challenge.expiresAt) {
      this.challenges.delete(challengeId);
      throw new GoneException('مهلت استفاده از کد به پایان رسیده است.');
    }
    const supplied = digest(code, challenge.salt);
    if (!timingSafeEqual(supplied, challenge.codeDigest)) {
      challenge.attempts += 1;
      if (challenge.attempts >= MAX_ATTEMPTS)
        this.challenges.delete(challengeId);
      throw new UnauthorizedException(
        challenge.attempts >= MAX_ATTEMPTS
          ? 'تعداد تلاش مجاز تمام شد؛ کد جدید دریافت کنید.'
          : 'کد واردشده صحیح نیست.',
      );
    }
    this.challenges.delete(challengeId);
    const token = randomBytes(32).toString('base64url');
    const grantDigest = digest(token).toString('hex');
    const expiresAt = now + GRANT_TTL_MS;
    this.grants.set(grantDigest, {
      digest: grantDigest,
      ...stored(binding),
      issuedAt: now,
      expiresAt,
    });
    return { grant: token, expiresAt };
  }

  inspectGrant(
    token: string,
    binding: PhoneVerificationBinding,
  ): InspectedPhoneGrant {
    developmentOnly();
    const grant = this.grant(token, binding);
    return {
      organizationId: grant.organizationId,
      issuedAt: grant.issuedAt,
      expiresAt: grant.expiresAt,
      canonicalPhone: grant.canonicalPhone,
    };
  }

  consume(
    token: string,
    binding: PhoneVerificationBinding,
    organizationId: string,
  ) {
    developmentOnly();
    const grant = this.grant(token, binding);
    if (
      grant.organizationId !== null &&
      grant.organizationId !== organizationId
    )
      throw new UnauthorizedException(
        'مجوز تأیید برای این سازمان صادر نشده است.',
      );
    this.grants.delete(grant.digest);
  }

  private grant(token: string, binding: PhoneVerificationBinding) {
    const now = Date.now();
    this.cleanup(now);
    const key = digest(token).toString('hex');
    const grant = this.grants.get(key);
    if (!grant || !sameCore(grant, binding))
      throw new UnauthorizedException('مجوز تأیید شماره معتبر نیست.');
    if (now >= grant.expiresAt) {
      this.grants.delete(key);
      throw new GoneException('مهلت مجوز تأیید شماره تمام شده است.');
    }
    return grant;
  }

  private registrationEntryCount(binding: PhoneVerificationBinding) {
    let count = 0;
    for (const item of this.challenges.values())
      if (
        item.actorUserId === binding.actor.userId &&
        item.registrationId === binding.registrationId
      )
        count += 1;
    for (const item of this.grants.values())
      if (
        item.actorUserId === binding.actor.userId &&
        item.registrationId === binding.registrationId
      )
        count += 1;
    return count;
  }

  private invalidateRegistration(binding: PhoneVerificationBinding) {
    for (const [key, item] of this.challenges)
      if (
        item.actorUserId === binding.actor.userId &&
        item.registrationId === binding.registrationId
      )
        this.challenges.delete(key);
    for (const [key, item] of this.grants)
      if (
        item.actorUserId === binding.actor.userId &&
        item.registrationId === binding.registrationId
      )
        this.grants.delete(key);
  }

  private cleanup(now: number) {
    for (const [key, item] of this.challenges)
      if (now >= item.expiresAt) this.challenges.delete(key);
    for (const [key, item] of this.grants)
      if (now >= item.expiresAt) this.grants.delete(key);
    for (const [key, history] of this.actorSends) {
      const active = history.filter((sentAt) => now - sentAt < RATE_WINDOW_MS);
      if (active.length) this.actorSends.set(key, active);
      else this.actorSends.delete(key);
    }
    for (const [key, history] of this.phoneSends) {
      const active = history.filter((sentAt) => now - sentAt < RATE_WINDOW_MS);
      if (active.length) this.phoneSends.set(key, active);
      else this.phoneSends.delete(key);
    }
  }

  private securityEntryCount() {
    return (
      this.challenges.size +
      this.grants.size +
      this.actorSends.size +
      this.phoneSends.size
    );
  }
}

export const phoneVerificationLimits = {
  challengeTtlMs: CHALLENGE_TTL_MS,
  grantTtlMs: GRANT_TTL_MS,
  resendCooldownMs: RESEND_COOLDOWN_MS,
  maxActorSends: MAX_ACTOR_SENDS,
  maxPhoneSends: MAX_PHONE_SENDS,
  maxAttempts: MAX_ATTEMPTS,
  maxSecurityEntries: MAX_SECURITY_ENTRIES,
} as const;
