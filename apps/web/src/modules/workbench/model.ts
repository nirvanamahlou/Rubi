import type {
  DocumentListResponseV1,
  LoginResponse,
  NotificationListResponseV1,
} from '@rubi/contracts';

export const workbenchTabs = [
  ['today', 'خانه'],
  ['requests', 'کارتابل درخواست‌ها'],
  ['messages', 'پیام‌ها'],
  ['files', 'فایل‌های من'],
  ['stars', 'ستاره‌دارها'],
  ['activity', 'فعالیت‌های من'],
  ['notes', 'یادداشت‌ها'],
  ['account', 'حساب و تنظیمات'],
] as const;
export type WorkbenchTab = (typeof workbenchTabs)[number][0];
export function normalizeWorkbenchTab(value: string | null): WorkbenchTab {
  return workbenchTabs.find(([id]) => id === value)?.[0] ?? 'today';
}
export type Resource<T> =
  | { status: 'ready'; data: T }
  | { status: 'error'; message: string }
  | { status: 'forbidden' };
export interface WorkbenchHome {
  user: LoginResponse['user'];
  notifications: Resource<NotificationListResponseV1>;
  documents: Resource<DocumentListResponseV1>;
}
export function safeWorkbenchHref(value: string | null): string | null {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    Array.from(value).some((character) => character.charCodeAt(0) <= 32)
  )
    return null;
  return value;
}
export function workbenchDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('fa-IR', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Tehran',
      }).format(date);
}
