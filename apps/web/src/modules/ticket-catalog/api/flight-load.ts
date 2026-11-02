'use client';
import type { FlightLoadContractsV1 } from '@nora/contracts';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

async function request(
  offerId: string,
  cancelled: boolean,
  excel: boolean,
  signal?: AbortSignal,
  retried = false,
): Promise<Response> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
  const response = await localizedFetch(
    `${base}/sales/flight-load/${encodeURIComponent(offerId)}/contracts${excel ? '.xlsx' : ''}?cancelled=${cancelled}`,
    {
      credentials: 'include',
      cache: 'no-store',
      ...(signal ? { signal } : {}),
    },
  );
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(base))
  )
    return request(offerId, cancelled, excel, signal, true);
  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new Error(
      error?.error?.message ??
        error?.message ??
        'دریافت گزارش انجام نشد؛ دسترسی و فیلترها را بررسی کنید.',
    );
  }
  return response;
}
export async function loadFlightContracts(
  offerId: string,
  cancelled: boolean,
  signal: AbortSignal,
): Promise<FlightLoadContractsV1> {
  return (
    await request(offerId, cancelled, false, signal)
  ).json() as Promise<FlightLoadContractsV1>;
}
export async function downloadFlightContracts(
  offerId: string,
  cancelled: boolean,
  signal: AbortSignal,
) {
  const response = await request(offerId, cancelled, true, signal);
  if (
    !response.headers
      .get('content-type')
      ?.includes(
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      )
  )
    throw new Error('دریافت گزارش انجام نشد؛ دسترسی و فیلترها را بررسی کنید.');
  return response.blob();
}
