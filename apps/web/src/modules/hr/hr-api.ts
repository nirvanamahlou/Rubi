'use client';

import type {
  HrBootstrapDto,
  HrEmployeeCreate,
  HrEmployeeDto,
  HrEmployeeUpdate,
  HrNotificationDto,
  HrRecordCreate,
  HrRecordDto,
  HrRecordUpdate,
} from '@rubi/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

export class HrApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
export async function hrRequest<T>(
  path: string,
  init: RequestInit = {},
  retried = false,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new HrApiError('آدرس سرویس منابع انسانی تنظیم نشده است.', 0);
  let response: Response;
  try {
    response = await fetch(`${base}/hr${path}`, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: { accept: 'application/json', ...init.headers },
    });
  } catch {
    throw new HrApiError(
      'ارتباط با سرور برقرار نشد؛ اطلاعات فرم حفظ شده است. اتصال را بررسی و دوباره تلاش کنید.',
      0,
    );
  }
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(base))
  )
    return hrRequest<T>(path, init, true);
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    const message =
      response.status === 409
        ? (data?.error?.message ??
          data?.message ??
          'این رکورد هم‌زمان تغییر کرده است. اطلاعات را تازه‌سازی کنید و تغییر خود را روی آخرین نسخه ثبت کنید.')
        : response.status === 401
          ? 'نشست ورود پایان یافته است. دوباره وارد شوید.'
          : response.status === 403
            ? 'برای این عملیات یا اطلاعات دسترسی ندارید.'
            : (data?.error?.message ??
              data?.message ??
              `عملیات انجام نشد (${response.status}).`);
    throw new HrApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
const json = (method: string, input: unknown, key?: string): RequestInit => ({
  method,
  headers: {
    'content-type': 'application/json',
    ...(key ? { 'Idempotency-Key': key } : {}),
  },
  body: JSON.stringify(input),
});
export const hrApi = {
  bootstrap: () => hrRequest<HrBootstrapDto>('/bootstrap'),
  employees: {
    create: (input: HrEmployeeCreate, key: string) =>
      hrRequest<HrEmployeeDto>('/employees', json('POST', input, key)),
    update: (id: string, input: HrEmployeeUpdate) =>
      hrRequest<HrEmployeeDto>(
        `/employees/${encodeURIComponent(id)}`,
        json('PATCH', input),
      ),
    remove: (id: string, version: number) =>
      hrRequest<void>(
        `/employees/${encodeURIComponent(id)}?version=${version}`,
        { method: 'DELETE' },
      ),
  },
  records: {
    list: (query: Record<string, string | number>) =>
      hrRequest<{ items: HrRecordDto[]; total: number }>(
        `/records?${new URLSearchParams(Object.entries(query).map(([k, v]) => [k, String(v)]))}`,
      ),
    create: (input: HrRecordCreate, key: string) =>
      hrRequest<HrRecordDto>('/records', json('POST', input, key)),
    update: (id: string, input: HrRecordUpdate) =>
      hrRequest<HrRecordDto>(
        `/records/${encodeURIComponent(id)}`,
        json('PATCH', input),
      ),
    remove: (id: string, version: number) =>
      hrRequest<void>(`/records/${encodeURIComponent(id)}?version=${version}`, {
        method: 'DELETE',
      }),
  },
  notifications: () => hrRequest<HrNotificationDto[]>('/notifications'),
  readNotification: (id: string) =>
    hrRequest<void>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
    }),
};
