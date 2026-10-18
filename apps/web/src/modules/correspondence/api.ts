import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import type {
  CorrespondenceUser,
  InternalLetterContent,
  InternalLetterList,
  InternalLetterRecord,
  InternalLetterStatus,
} from '@nora/contracts';

async function internalRequest<T>(
  path: string,
  method = 'GET',
  body?: unknown,
  retried = false,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await localizedFetch(
    `${base}/correspondence/v1/internal${path}`,
    {
      method,
      credentials: 'include',
      cache: 'no-store',
      ...(body === undefined
        ? {}
        : {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }),
    },
  );
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(base))
  )
    return internalRequest<T>(path, method, body, true);
  const result = (await response.json().catch(() => null)) as {
    message?: string;
    error?: { message?: string };
  } | null;
  if (!response.ok)
    throw new Error(
      result?.error?.message || result?.message || 'عملیات مکاتبات ناموفق بود.',
    );
  return result as T;
}
export const internalLetters = {
  users: () => internalRequest<CorrespondenceUser[]>('/users'),
  list: (query: URLSearchParams) =>
    internalRequest<InternalLetterList>(`?${query.toString()}`),
  detail: (id: string) =>
    internalRequest<InternalLetterRecord>(`/${encodeURIComponent(id)}`),
  send: (
    letter: InternalLetterContent,
    dateISO: string,
    recipientId: string,
    requestKey: string,
  ) =>
    internalRequest<{ id: string }>('', 'POST', {
      letter,
      dateISO,
      recipientId,
      requestKey,
    }),
  edit: (id: string, version: number, letter: InternalLetterContent) =>
    internalRequest<{ id: string; version: number }>(`/${id}`, 'PATCH', {
      version,
      letter,
    }),
  forward: (
    id: string,
    version: number,
    recipientId: string,
    status: InternalLetterStatus,
    requestKey: string,
  ) =>
    internalRequest<{ id: string }>(`/${id}/forward`, 'POST', {
      version,
      recipientId,
      status,
      requestKey,
    }),
  read: (id: string) => internalRequest<{ id: string }>(`/${id}/read`, 'POST'),
  remove: (id: string, version: number) =>
    internalRequest<{ id: string }>(`/${id}`, 'DELETE', { version }),
};

export async function issueLetterNumber(
  companyId: string,
  date: string,
  idempotencyKey: string,
  retried = false,
): Promise<{ number: string; date: string }> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await localizedFetch(
    `${baseUrl}/correspondence/v1/numbers`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, date, idempotencyKey }),
    },
  );
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(baseUrl))
  )
    return issueLetterNumber(companyId, date, idempotencyKey, true);
  const result = (await response.json().catch(() => null)) as {
    number?: string;
    date?: string;
    message?: string;
    error?: { message?: string };
  } | null;
  if (!response.ok || !result?.number || !result.date)
    throw new Error(
      result?.error?.message ||
        result?.message ||
        'شماره‌گذاری نامه ناموفق بود.',
    );
  return { number: result.number, date: result.date };
}
