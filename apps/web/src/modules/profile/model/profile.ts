import type { IamMfaStatusV1, LoginResponse } from '@rubi/contracts';

export const PROFILE_USER_FALLBACK = 'کاربر سامانه';

export type AuthenticatedProfileUser = LoginResponse['user'];

export interface AuthenticatedSessionSummary {
  id: string;
  status: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
}

export interface AuthenticatedProfile {
  user: AuthenticatedProfileUser;
  sessions: AuthenticatedSessionSummary[];
  mfa: IamMfaStatusV1;
  loggedInAt: string | null;
}

export type ProfileTab = 'overview' | 'preferences' | 'security';

const permissionGroupLabels: Readonly<Record<string, string>> = {
  iam: 'مدیریت هویت',
  master_data: 'اطلاعات پایه',
  customers: 'مشتریان',
  b2b: 'همکاری سازمانی',
  'legal-entity': 'شرکت‌ها',
  documents: 'اسناد',
  notifications: 'اعلان‌ها',
};

export function normalizeProfileTab(value: string | null): ProfileTab {
  return value === 'preferences' || value === 'security' ? value : 'overview';
}

export function safeProfileDisplayName(
  displayName: string | null | undefined,
): string {
  return displayName?.trim() || PROFILE_USER_FALLBACK;
}

export function profileInitials(
  displayName: string | null | undefined,
): string {
  const parts = safeProfileDisplayName(displayName)
    .split(/\s+/u)
    .filter(Boolean);
  return `${parts[0]?.[0] ?? 'ک'}${parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : ''}`;
}

export function activeProfileSessions(
  sessions: readonly AuthenticatedSessionSummary[],
): AuthenticatedSessionSummary[] {
  return sessions.filter(({ status }) => status === 'ACTIVE');
}

export function summarizePermissions(permissions: readonly string[]) {
  const groups = new Map<string, number>();
  for (const permission of permissions) {
    const prefix = permission.split('.')[0] || 'other';
    groups.set(prefix, (groups.get(prefix) ?? 0) + 1);
  }
  return [...groups.entries()]
    .map(([key, count]) => ({
      key,
      count,
      label: permissionGroupLabels[key] ?? 'سایر دسترسی‌ها',
    }))
    .sort((first, second) => first.label.localeCompare(second.label, 'fa'));
}

export function formatProfileDate(value: string | null | undefined): string {
  if (!value) return 'در دسترس نیست';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'در دسترس نیست';
  return new Intl.DateTimeFormat('fa-IR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function isAuthenticatedProfileUser(
  value: unknown,
): value is AuthenticatedProfileUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Partial<AuthenticatedProfileUser>;
  return (
    typeof user.id === 'string' &&
    typeof user.username === 'string' &&
    typeof user.displayName === 'string' &&
    (typeof user.email === 'string' || user.email === null) &&
    Array.isArray(user.permissions) &&
    Array.isArray(user.branches)
  );
}
