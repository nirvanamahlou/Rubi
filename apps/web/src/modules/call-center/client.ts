import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import type { Call } from './model';

export interface CallNote {
  id: string;
  contactId: string;
  text: string;
  at: string;
  actorUserId: string;
}
export interface CallCenterPage {
  data: { id: string; calls: Call[]; notes: CallNote[] }[];
  meta: { branchId: string; total: number; page: number; pageSize: number };
}
export class CallCenterHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'CallCenterHttpError';
  }
}
export async function callCenterRequest<T>(
  path: string,
  branchId: string,
  init: RequestInit = {},
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی API پیکربندی نشده است.');
  const response = await localizedFetch(
    `${base}/customer-affairs/call-center${path}`,
    {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: {
        accept: 'application/json',
        'x-branch-id': branchId,
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
    },
  );
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new CallCenterHttpError(
      body?.error?.message ??
        body?.message ??
        'ارتباط با کال سنتر برقرار نشد. دوباره تلاش کنید.',
      response.status,
    );
  }
  return response.json() as Promise<T>;
}
const request = callCenterRequest;
export const callCenterApi = {
  destinations: (branchId: string, signal: AbortSignal) =>
    request<{ data: { label: string; extension: string }[] }>(
      '/destination-options',
      branchId,
      { signal },
    ),
  get: (branchId: string, id: string) =>
    request<{ data: Call }>(`/calls/${encodeURIComponent(id)}`, branchId),
  list: (branchId: string, page = 1, signal?: AbortSignal) =>
    request<CallCenterPage>(
      `?page=${page}&pageSize=50`,
      branchId,
      signal ? { signal } : {},
    ),
  create: (branchId: string, call: Call) =>
    request<{ data: Call }>('/calls', branchId, {
      method: 'POST',
      body: JSON.stringify({
        id: call.id,
        ...(call.completionToken
          ? { completionToken: call.completionToken }
          : {}),
        ...(call.ticketId ? { ticketId: call.ticketId } : {}),
        ...(call.outcome ? { outcome: call.outcome } : {}),
        phone: call.phone,
        occurredAt: call.occurredAt,
        direction: call.direction,
        name: call.name,
        subject: call.subject,
        source: call.source,
        operator: call.operator,
        status: call.status,
        note: call.note,
      }),
    }),
  note: (branchId: string, contactId: string, id: string, text: string) =>
    request<{ data: CallNote }>(
      `/contacts/${encodeURIComponent(contactId)}/notes`,
      branchId,
      { method: 'POST', body: JSON.stringify({ id, text }) },
    ),
};
