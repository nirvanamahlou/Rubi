import { authenticatedFetch } from '@/lib/authenticated-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
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
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await authenticatedFetch(
    `${base}/correspondence/v1/internal${path}`,
    base,
    {
      method,
      timeoutMs: null,
      ...(body instanceof FormData
        ? { body }
        : body === undefined
          ? {}
          : {
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }),
    },
  );
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
  currentUser: () => internalRequest<CorrespondenceUser>('/me'),
  async attachment(letterId: string, id: string) {
    const base = getPublicApiBaseUrl();
    if (!base) throw new Error('نشانی API پیکربندی نشده است.');
    const response = await authenticatedFetch(
      `${base}/correspondence/v1/internal/${encodeURIComponent(letterId)}/attachments/${encodeURIComponent(id)}`,
      base,
      { timeoutMs: null },
    );
    if (!response.ok) throw new Error('دریافت پیوست نامه انجام نشد.');
    return response.blob();
  },
  list: (query: URLSearchParams) =>
    internalRequest<InternalLetterList>(`?${query.toString()}`),
  detail: (id: string) =>
    internalRequest<InternalLetterRecord>(`/${encodeURIComponent(id)}`),
  send: (
    letter: InternalLetterContent,
    dateISO: string,
    recipientId: string | string[],
    requestKey: string,
    addressedUserId?: string,
    files: readonly File[] = [],
  ) => {
    const input = {
      letter,
      dateISO,
      ...(Array.isArray(recipientId)
        ? { recipientIds: recipientId }
        : { recipientId }),
      requestKey,
      addressedUserId,
    };
    if (!files.length)
      return internalRequest<{ id: string }>('', 'POST', input);
    const form = new FormData();
    form.append('letter', JSON.stringify(input));
    files.forEach((file) => form.append('files', file));
    return internalRequest<{ id: string }>('/with-attachments', 'POST', form);
  },
  edit: (id: string, version: number, letter: InternalLetterContent) =>
    internalRequest<{ id: string; version: number }>(`/${id}`, 'PATCH', {
      version,
      letter,
    }),
  forward: (
    id: string,
    version: number,
    recipientId: string | string[],
    status: InternalLetterStatus,
    requestKey: string,
    description = '',
  ) =>
    internalRequest<{ id: string }>(`/${id}/forward`, 'POST', {
      version,
      ...(Array.isArray(recipientId)
        ? { recipientIds: recipientId }
        : { recipientId }),
      status,
      requestKey,
      description,
    }),
  read: (id: string) => internalRequest<{ id: string }>(`/${id}/read`, 'POST'),
  remove: (id: string, version: number) =>
    internalRequest<{ id: string }>(`/${id}`, 'DELETE', { version }),
};

export async function issueLetterNumber(
  companyId: string,
  date: string,
  idempotencyKey: string,
): Promise<{ number: string; date: string }> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await authenticatedFetch(
    `${baseUrl}/correspondence/v1/numbers`,
    baseUrl,
    {
      method: 'POST',
      cache: 'default',
      timeoutMs: null,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId, date, idempotencyKey }),
    },
  );
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
