import type { LoginResponse } from '@rubi/contracts';

const HEADER_SESSION_STORAGE_KEY = 'rubi:header-session:v1';

type LoginUser = LoginResponse['user'];
type HeaderSessionStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export interface HeaderSessionIdentity {
  displayName: string;
  loggedInAt: string;
}

function browserSessionStorage(): HeaderSessionStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isHeaderSessionIdentity(
  value: unknown,
): value is HeaderSessionIdentity {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<HeaderSessionIdentity>;
  return (
    typeof candidate.displayName === 'string' &&
    typeof candidate.loggedInAt === 'string' &&
    Number.isFinite(Date.parse(candidate.loggedInAt))
  );
}

export function readHeaderSession(
  storage: HeaderSessionStorage | null = browserSessionStorage(),
): HeaderSessionIdentity | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(HEADER_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isHeaderSessionIdentity(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function rememberHeaderSession(
  user: LoginUser,
  loggedInAt = new Date().toISOString(),
  storage: HeaderSessionStorage | null = browserSessionStorage(),
): HeaderSessionIdentity {
  const identity: HeaderSessionIdentity = {
    displayName: user.displayName.trim() || 'کاربر سامانه',
    loggedInAt,
  };
  try {
    storage?.setItem(HEADER_SESSION_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // A blocked Session Storage must not break authentication or navigation.
  }
  return identity;
}

export function clearHeaderSession(
  storage: HeaderSessionStorage | null = browserSessionStorage(),
): void {
  try {
    storage?.removeItem(HEADER_SESSION_STORAGE_KEY);
  } catch {
    // A blocked Session Storage must not break secure logout.
  }
}

export function formatHeaderLoginTime(loggedInAt: string): string {
  const value = new Date(loggedInAt);
  if (Number.isNaN(value.getTime())) return '—';
  return new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}
