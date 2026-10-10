import { USER_JOB_TITLES, type LoginResponse } from '@nora/contracts';

const HEADER_SESSION_STORAGE_KEY = 'nora:header-session:v1';
const HEADER_SESSION_CHANGED_EVENT = 'nora:header-session-changed';

type LoginUser = LoginResponse['user'];
type HeaderSessionStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export interface HeaderSessionIdentity {
  displayName: string;
  loggedInAt: string;
  roleNames: string[];
}

function browserSessionStorage(): HeaderSessionStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function selectedHeaderRoleName(roleNames: readonly string[]) {
  return (
    roleNames.find((name) =>
      USER_JOB_TITLES.includes(name as (typeof USER_JOB_TITLES)[number]),
    ) ?? (roleNames.includes('مدیر سیستم') ? USER_JOB_TITLES[0] : undefined)
  );
}

function isHeaderSessionIdentity(
  value: unknown,
): value is HeaderSessionIdentity {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<HeaderSessionIdentity>;
  return (
    typeof candidate.displayName === 'string' &&
    typeof candidate.loggedInAt === 'string' &&
    (candidate.roleNames === undefined ||
      (Array.isArray(candidate.roleNames) &&
        candidate.roleNames.every((role) => typeof role === 'string'))) &&
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
    if (!isHeaderSessionIdentity(parsed)) return null;
    const selectedTitle = selectedHeaderRoleName(parsed.roleNames ?? []);
    return { ...parsed, roleNames: selectedTitle ? [selectedTitle] : [] };
  } catch {
    return null;
  }
}

export function rememberHeaderSession(
  user: LoginUser,
  loggedInAt = new Date().toISOString(),
  storage: HeaderSessionStorage | null = browserSessionStorage(),
): HeaderSessionIdentity {
  const assignedRoles = user.roles ?? [];
  const selectedTitle =
    assignedRoles.find(({ name }) =>
      USER_JOB_TITLES.includes(name as (typeof USER_JOB_TITLES)[number]),
    )?.name ??
    (assignedRoles.some(({ code }) => code === 'administrator')
      ? USER_JOB_TITLES[0]
      : undefined);
  const identity: HeaderSessionIdentity = {
    displayName: user.displayName.trim() || 'کاربر سامانه',
    loggedInAt,
    roleNames: selectedTitle ? [selectedTitle] : [],
  };
  try {
    storage?.setItem(HEADER_SESSION_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // A blocked Session Storage must not break authentication or navigation.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(HEADER_SESSION_CHANGED_EVENT));
  }
  return identity;
}

export function subscribeHeaderSession(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  window.addEventListener(HEADER_SESSION_CHANGED_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(HEADER_SESSION_CHANGED_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function getHeaderRoleLabel(
  storage: HeaderSessionStorage | null = browserSessionStorage(),
): string {
  return readHeaderSession(storage)?.roleNames[0] ?? '';
}

export function clearHeaderSession(
  storage: HeaderSessionStorage | null = browserSessionStorage(),
): void {
  try {
    storage?.removeItem(HEADER_SESSION_STORAGE_KEY);
  } catch {
    // A blocked Session Storage must not break secure logout.
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(HEADER_SESSION_CHANGED_EVENT));
  }
}

export function formatHeaderLoginTime(loggedInAt: string): string {
  const value = new Date(loggedInAt);
  if (Number.isNaN(value.getTime())) return '—';
  return new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);
}
