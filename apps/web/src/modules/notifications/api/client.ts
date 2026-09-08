import type {
  NotificationListResponseV1,
  NotificationReadResponseV1,
} from '@rubi/contracts';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

export const NOTIFICATIONS_CHANGED_EVENT = 'rubi:notifications:changed';

export function notifyNotificationFeedChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  retriedAfterRefresh = false,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await fetch(`${baseUrl}/notifications${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: { accept: 'application/json', ...init?.headers },
  });
  if (
    response.status === 401 &&
    !retriedAfterRefresh &&
    (await refreshAuthenticatedSession(baseUrl))
  ) {
    return request<T>(path, init, true);
  }
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new Error(
      envelope?.error?.message ??
        envelope?.message ??
        'دریافت اعلان‌ها ناموفق بود.',
    );
  }
  return response.json() as Promise<T>;
}

export const notificationsApi = {
  list(limit = 20) {
    return request<NotificationListResponseV1>(`?limit=${limit}`);
  },
  markRead(id: string) {
    return request<NotificationReadResponseV1>(
      `/${encodeURIComponent(id)}/read`,
      { method: 'PATCH' },
    );
  },
  markAllRead() {
    return request<NotificationReadResponseV1>('/read-all', {
      method: 'PATCH',
    });
  },
  clearRead() {
    return request<NotificationReadResponseV1>('/read', {
      method: 'DELETE',
    });
  },
};
