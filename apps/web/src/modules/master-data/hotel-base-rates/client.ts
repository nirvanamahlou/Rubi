'use client';

import type {
  LoginResponse,
  MasterHotelRatePeriodDetailV1,
  MasterHotelRatePeriodSaveV1,
  MasterHotelRatePeriodSummaryV1,
} from '@nora/contracts';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { getPublicApiBaseUrl } from '@/lib/environment';

export type HotelRateOption = {
  id: string;
  name: string;
  englishName: string | null;
  version: number;
  starRating?: number | null;
};

export class HotelBaseRateApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit) {
  const baseUrl = getPublicApiBaseUrl();
  if (!baseUrl) throw new HotelBaseRateApiError('نشانی API تنظیم نشده است.', 0);
  const run = () =>
    fetch(`${baseUrl}/master-data/hotel-rate-periods${path}`, {
      credentials: 'include',
      cache: 'no-store',
      ...init,
      headers: {
        accept: 'application/json',
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  let response = await run().catch(() => null);
  if (response?.status === 401 && (await refreshAuthenticatedSession(baseUrl)))
    response = await run().catch(() => null);
  if (!response)
    throw new HotelBaseRateApiError('ارتباط با سرور برقرار نشد.', 0);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
      error?: { code?: string; message?: string };
    } | null;
    const code = body?.error?.code ?? body?.code;
    throw new HotelBaseRateApiError(
      body?.error?.message ??
        body?.message ??
        (response.status === 403
          ? 'مجوز این عملیات را ندارید.'
          : response.status === 409
            ? 'این بازه هم‌زمان تغییر کرده است؛ دوباره بازش کنید.'
            : 'عملیات نرخ هتل ناموفق بود.'),
      response.status,
      code,
    );
  }
  return response.json() as Promise<T>;
}

export const hotelBaseRateApi = {
  session: async (): Promise<LoginResponse> => {
    const baseUrl = getPublicApiBaseUrl();
    if (!baseUrl)
      throw new HotelBaseRateApiError('نشانی API تنظیم نشده است.', 0);
    const session = await refreshAuthenticatedSession(baseUrl);
    if (!session)
      throw new HotelBaseRateApiError('برای ادامه وارد حساب شوید.', 401);
    return session;
  },
  options: (kind: 'cities' | 'hotels', cityId?: string) =>
    request<{ data: readonly HotelRateOption[] }>(
      `/options?kind=${kind}${cityId ? `&cityId=${encodeURIComponent(cityId)}` : ''}`,
    ),
  list: (branchId?: string) =>
    request<{
      version: 1;
      data: readonly MasterHotelRatePeriodSummaryV1[];
    }>(`?${branchId ? `branchId=${encodeURIComponent(branchId)}` : ''}`),
  detail: (id: string) =>
    request<{ version: 1; data: MasterHotelRatePeriodDetailV1 }>(
      `/${encodeURIComponent(id)}`,
    ),
  save: (input: MasterHotelRatePeriodSaveV1, key: string, id?: string) =>
    request<{ data: { id: string; version: number } }>(
      id ? `/${encodeURIComponent(id)}` : '',
      {
        method: id ? 'PATCH' : 'POST',
        headers: { 'idempotency-key': key },
        body: JSON.stringify(input),
      },
    ),
};
