'use client';
import type {
  TourPackageV1,
  TourDepartureV1,
  TourPackageInputV1,
  TourDepartureInputV1,
  TicketOfferV1,
  TicketOfferCreateV1,
} from '@rubi/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';

async function request<T>(
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('نشانی سرور تنظیم نشده است.');
  const response = await fetch(`${base}/ticket-catalog${path}`, {
    credentials: 'include',
    cache: 'no-store',
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  if (
    response.status === 401 &&
    !retried &&
    (await refreshAuthenticatedSession(base))
  )
    return request<T>(path, init, true);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      message?: string;
      error?: { message?: string };
    } | null;
    throw new Error(
      body?.error?.message ??
        body?.message ??
        'دریافت یا ثبت تور ناموفق بود؛ نشست و دسترسی را بررسی کنید.',
    );
  }
  return response.json() as Promise<T>;
}
const post = (body: unknown, branch: string, key: string): RequestInit => ({
  method: 'POST',
  headers: { 'x-branch-id': branch, 'idempotency-key': key },
  body: JSON.stringify(body),
});
export const toursApi = {
  packages: () => request<{ data: TourPackageV1[] }>('/tours/packages'),
  departures: () => request<{ data: TourDepartureV1[] }>('/tours/departures'),
  createPackage: (input: TourPackageInputV1, branch: string, key: string) =>
    request<{ data: TourPackageV1 }>(
      '/tours/packages',
      post(input, branch, key),
    ),
  createDeparture: (input: TourDepartureInputV1, branch: string, key: string) =>
    request<{ data: TourDepartureV1 }>(
      '/tours/departures',
      post(input, branch, key),
    ),
  offers: async (originId: string, destinationId: string, day: string) => {
    const data: TicketOfferV1[] = [];
    const departureFrom = new Date(`${day}T00:00:00+03:30`).toISOString();
    for (let page = 1; ; page++) {
      const result = await request<{ data: TicketOfferV1[]; hasMore: boolean }>(
        `/offers?${new URLSearchParams({ originId, destinationId, departureFrom, departureTo: day, page: String(page) })}`,
      );
      data.push(
        ...result.data.filter(
          (offer) =>
            new Intl.DateTimeFormat('en-CA', {
              timeZone: 'Asia/Tehran',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(new Date(offer.departureAt)) === day,
        ),
      );
      if (!result.hasMore) return data;
    }
  },
  publishOffer: (input: TicketOfferCreateV1, branch: string, key: string) =>
    request<{ data: { id: string } }>('/offers', post(input, branch, key)),
};
