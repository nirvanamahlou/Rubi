'use client';
import { localizedFetch } from '@/i18n/localized-fetch';

import { z } from 'zod';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import type { IssuedTicketQuery } from '../model/issued-tickets';
const row = z.object({
  id: z.string(),
  contractNumber: z.string(),
  passengerDisplayName: z.string(),
  ticketNumber: z.string(),
  pnr: z.string().nullable(),
  originCityId: z.string(),
  origin: z.string(),
  destinationCityId: z.string(),
  destination: z.string(),
  airlineId: z.string(),
  airline: z.string(),
  issuedAt: z.string().datetime(),
  departureAt: z.string().datetime(),
  status: z.enum(['issued', 'voided']),
});
export function issuedReportQuery(query: IssuedTicketQuery) {
  if (!query.issuedFrom || !query.issuedTo || query.issuedFrom > query.issuedTo)
    throw new Error(
      'بازه تاریخ صدور را انتخاب کنید؛ تاریخ پایان نباید قبل از شروع باشد.',
    );
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (key !== 'page' && value && value !== 'all')
      params.set(key, String(value));
  return params.toString();
}
async function reportFetch(
  path: string,
  signal?: AbortSignal,
  retried = false,
): Promise<Response> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
  const response = await localizedFetch(
    path.startsWith('/') ? path : base + '/reservations/requests/' + path,
    {
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      ...(signal ? { signal } : {}),
    },
  );
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(base))
  )
    return reportFetch(path, signal, true);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    throw new Error(
      body?.message ||
        'دریافت گزارش انجام نشد؛ دسترسی و فیلترها را بررسی کنید.',
    );
  }
  return response;
}
export async function loadReservationIssuedTickets(
  signal: AbortSignal,
  query: IssuedTicketQuery,
) {
  const response = await reportFetch(
    'issued-tickets?' + issuedReportQuery(query),
    signal,
  );
  return z.object({ data: z.array(row) }).parse(await response.json()).data;
}
export async function downloadIssuedTicketReport(
  query: IssuedTicketQuery,
  format: 'xlsx' | 'pdf',
) {
  const params = issuedReportQuery(query);
  const response = await reportFetch(
    format === 'pdf'
      ? '/ticket-catalog/issued/export/pdf?' + params
      : 'issued-tickets/export?' + params,
  );
  const contentType = response.headers.get('content-type') ?? '';
  const expected =
    format === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (!contentType.includes(expected))
    throw new Error(
      'فایل خروجی معتبر دریافت نشد؛ دوباره وارد سامانه شوید و تلاش کنید.',
    );
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `issued-tickets-${query.issuedFrom}-${query.issuedTo}.${format}`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
