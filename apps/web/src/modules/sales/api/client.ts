'use client';

import type {
  SalesContractCreateRequest,
  SalesContractDetail,
  SalesContractListQuery,
  SalesContractPage,
  SalesDashboard,
  SalesPaymentCreateRequest,
} from '@rubi/contracts';

import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

export class SalesApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<T> {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new SalesApiError('نشانی API پیکربندی نشده است.', 0);
  const response = await fetch(`${baseUrl}/sales${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...init?.headers,
    },
  }).catch(() => {
    throw new SalesApiError(
      'ارتباط با سرور برقرار نشد؛ اتصال را بررسی و دوباره تلاش کنید.',
      0,
      'NETWORK_ERROR',
    );
  });
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(baseUrl))
  )
    return request<T>(path, init, true);
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    } | null;
    throw new SalesApiError(
      response.status === 401
        ? 'نشست شما پایان یافته است؛ دوباره وارد حساب شوید.'
        : (payload?.error?.message ??
            payload?.message ??
            'عملیات فروش ناموفق بود.'),
      response.status,
      payload?.error?.code ?? payload?.code,
    );
  }
  return response.json() as Promise<T>;
}

function queryString(query: SalesContractListQuery): string {
  const parameters = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== '') parameters.set(key, String(value));
  return parameters.toString();
}

export const salesApi = {
  dashboard: () => request<SalesDashboard>('/dashboard'),
  addPayment: (id: string, input: SalesPaymentCreateRequest, key: string) =>
    request<{ data: SalesContractDetail }>(
      `/contracts/${encodeURIComponent(id)}/payments`,
      {
        method: 'POST',
        headers: { 'idempotency-key': key },
        body: JSON.stringify(input),
      },
    ),
  list: (query: SalesContractListQuery) =>
    request<SalesContractPage>(`/contracts?${queryString(query)}`),
  detail: (id: string) =>
    request<{ data: SalesContractDetail }>(
      `/contracts/${encodeURIComponent(id)}`,
    ),
  confirm: (id: string, version: number) =>
    request<{ data: SalesContractDetail }>(
      `/contracts/${encodeURIComponent(id)}/confirm`,
      {
        method: 'POST',
        headers: { 'idempotency-key': `confirm-${id}-${version}` },
        body: JSON.stringify({ version }),
      },
    ),
  async create(
    input: SalesContractCreateRequest,
    idempotencyKey: string = crypto.randomUUID(),
  ) {
    const baseUrl = getPublicApiBaseUrl();
    if (!baseUrl) throw new SalesApiError('نشانی API پیکربندی نشده است.', 0);
    const session = await refreshAuthenticatedSession(baseUrl);
    const branchId = session?.user?.branches?.[0]?.id;
    if (!branchId)
      throw new SalesApiError('شعبه فعال برای ثبت قرارداد یافت نشد.', 403);
    return request<{
      data: SalesContractDetail;
      meta: { idempotentReplay: boolean };
    }>('/contracts', {
      method: 'POST',
      headers: {
        'x-branch-id': branchId,
        'idempotency-key': idempotencyKey,
      },
      body: JSON.stringify(input),
    });
  },
};
