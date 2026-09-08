import type {
  IamMfaStatusResponseV1,
  IamMfaStatusV1,
  LoginResponse,
} from '@rubi/contracts';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { readHeaderSession } from '@/lib/header-session';
import {
  isAuthenticatedProfileUser,
  type AuthenticatedProfile,
  type AuthenticatedSessionSummary,
} from '../model/profile';

export class ProfileUnauthorizedError extends Error {
  constructor() {
    super('نشست معتبر برای مشاهده پروفایل وجود ندارد.');
    this.name = 'ProfileUnauthorizedError';
  }
}

interface LoadProfileDependencies {
  baseUrl?: string | null;
  fetchImpl?: typeof fetch;
  refresh?: (baseUrl: string) => Promise<LoginResponse | null>;
  loggedInAt?: string | null;
}

export async function loadAuthenticatedProfile(
  dependencies: LoadProfileDependencies = {},
): Promise<AuthenticatedProfile | null> {
  const baseUrl = dependencies.baseUrl ?? getPublicApiBaseUrl();
  if (!baseUrl) throw new Error('آدرس API برای دریافت پروفایل تنظیم نشده است.');
  const refresh = dependencies.refresh ?? refreshAuthenticatedSession;
  const session = await refresh(baseUrl);
  if (!session) throw new ProfileUnauthorizedError();
  if (!isAuthenticatedProfileUser(session.user)) return null;

  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const [sessionsResponse, mfaResponse] = await Promise.all([
    fetchImpl(`${baseUrl}/iam/auth/sessions`, authenticatedGet()),
    fetchImpl(`${baseUrl}/iam/auth/mfa/status`, authenticatedGet()),
  ]);
  if (sessionsResponse.status === 401 || mfaResponse.status === 401)
    throw new ProfileUnauthorizedError();
  if (!sessionsResponse.ok || !mfaResponse.ok)
    throw new Error('دریافت اطلاعات امنیتی پروفایل ناموفق بود.');

  const sessionsPayload: unknown = await sessionsResponse.json();
  const mfaPayload: unknown = await mfaResponse.json();
  return {
    user: session.user,
    sessions: parseSessions(sessionsPayload),
    mfa: parseMfaStatus(mfaPayload),
    loggedInAt:
      dependencies.loggedInAt === undefined
        ? (readHeaderSession()?.loggedInAt ?? null)
        : dependencies.loggedInAt,
  };
}

export async function logoutAuthenticatedSession(
  baseUrl = getPublicApiBaseUrl(),
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (!baseUrl) return;
  await fetchImpl(`${baseUrl}/iam/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { accept: 'application/json' },
  });
}

function authenticatedGet(): RequestInit {
  return {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store',
    headers: { accept: 'application/json' },
  };
}

function parseSessions(value: unknown): AuthenticatedSessionSummary[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const session = candidate as Partial<AuthenticatedSessionSummary>;
    if (
      typeof session.id !== 'string' ||
      typeof session.status !== 'string' ||
      typeof session.createdAt !== 'string' ||
      typeof session.lastUsedAt !== 'string' ||
      typeof session.expiresAt !== 'string'
    )
      return [];
    return [session as AuthenticatedSessionSummary];
  });
}

function parseMfaStatus(value: unknown): IamMfaStatusV1 {
  const data = (value as Partial<IamMfaStatusResponseV1> | null)?.data;
  if (
    !data ||
    typeof data.enabled !== 'boolean' ||
    typeof data.setupPending !== 'boolean' ||
    (typeof data.lockedUntil !== 'string' && data.lockedUntil !== null)
  )
    throw new Error('پاسخ وضعیت احراز هویت دومرحله‌ای معتبر نیست.');
  return data;
}
