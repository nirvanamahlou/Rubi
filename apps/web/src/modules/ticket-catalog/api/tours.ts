'use client';
import type {
  TourPackageV1,
  TourDepartureV1,
  TourPackageInputV1,
  TourDepartureInputV1,
  TicketOfferV1,
  TicketSaleCommissionUpdateV1,
  TicketOfferCreateV1,
  TicketRoundTripSalePriceUpdateV1,
  TicketSalePriceTargetCreateV1,
  TicketSalePriceTargetV1,
  TicketStandaloneSalePriceUpdateV1,
} from '@nora/contracts';
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
  manifestTemplates: (search: string, page: number) =>
    request<{ data: { id: string; name: string }[]; hasMore: boolean }>(
      '/offers/manifest-templates?' +
        new URLSearchParams({ search, page: String(page) }),
    ),
  salePriceTargets: () =>
    request<{ version: 1; data: TicketSalePriceTargetV1[] }>(
      '/sale-price-targets',
    ),
  createSalePriceTarget: (
    input: TicketSalePriceTargetCreateV1,
    branch: string,
  ) =>
    request<{ data: TicketSalePriceTargetV1 }>(
      '/sale-price-targets',
      post(input, branch, crypto.randomUUID()),
    ),
  removeSalePriceTarget: (id: string, expectedVersion: number) =>
    request<{ data: { id: string; isActive: boolean; version: number } }>(
      `/sale-price-targets/${encodeURIComponent(id)}`,
      { method: 'DELETE', body: JSON.stringify({ expectedVersion }) },
    ),
  packages: () => request<{ data: TourPackageV1[] }>('/tours/packages'),
  departures: () => request<{ data: TourDepartureV1[] }>('/tours/departures'),
  createPackage: (input: TourPackageInputV1, branch: string, key: string) =>
    request<{ data: TourPackageV1 }>(
      '/tours/packages',
      post(input, branch, key),
    ),
  updatePackage: (
    id: string,
    input: TourPackageInputV1,
    expectedVersion: number,
    branch: string,
  ) =>
    request<{ data: TourPackageV1 }>(
      `/tours/packages/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: { 'x-branch-id': branch },
        body: JSON.stringify({ ...input, expectedVersion }),
      },
    ),
  deletePackage: (id: string, expectedVersion: number, branch: string) =>
    request<{ data: { id: string; deleted: true } }>(
      `/tours/packages/${encodeURIComponent(id)}`,
      {
        method: 'DELETE',
        headers: { 'x-branch-id': branch },
        body: JSON.stringify({ expectedVersion }),
      },
    ),
  createDeparture: (input: TourDepartureInputV1, branch: string, key: string) =>
    request<{ data: TourDepartureV1 }>(
      '/tours/departures',
      post(input, branch, key),
    ),
  offers: async (
    originId: string,
    destinationId: string,
    startsOn: string,
    endsOn = startsOn,
  ) => {
    const data: TicketOfferV1[] = [];
    const departureFrom = new Date(`${startsOn}T00:00:00+03:30`).toISOString();
    for (let page = 1; ; page++) {
      const result = await request<{ data: TicketOfferV1[]; hasMore: boolean }>(
        `/offers?${new URLSearchParams({ originId, destinationId, departureFrom, departureTo: endsOn, page: String(page) })}`,
      );
      data.push(
        ...result.data.filter((offer) => {
          const localDay = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Asia/Tehran',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          }).format(new Date(offer.departureAt));
          return localDay >= startsOn && localDay <= endsOn;
        }),
      );
      if (!result.hasMore) return data;
    }
  },
  updateSaleCommission: (input: TicketSaleCommissionUpdateV1, key: string) =>
    request<{ data: { count: number; revision: number } }>(
      '/offers/sale-commissions',
      {
        method: 'PATCH',
        headers: { 'idempotency-key': key },
        body: JSON.stringify(input),
      },
    ),
  managedOffers: async (includePast = false) => {
    const offers = new Map<string, TicketOfferV1>();
    for (let page = 1; page <= 10000; page++) {
      const result = await request<{
        version: 1;
        data: TicketOfferV1[];
        hasMore?: boolean;
      }>(
        includePast
          ? `/offers/management?includePast=true&page=${page}`
          : page === 1
            ? '/offers/management'
            : `/offers/management?page=${page}`,
      );
      for (const offer of result.data) offers.set(offer.id, offer);
      if (!result.hasMore)
        return { version: 1 as const, data: [...offers.values()] };
    }
    throw new Error('تعداد صفحات بلیت از حد مجاز بیشتر است.');
  },
  reviseOffer: (
    id: string,
    expectedVersion: number,
    offer: TicketOfferCreateV1,
  ) =>
    request<{ data: { id: string; version: number } }>(`/offers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ expectedVersion, offer }),
    }),
  updateOfferStatus: (
    id: string,
    expectedVersion: number,
    status: 'ACTIVE' | 'PAUSED',
  ) =>
    request<{
      data: { id: string; version: number; status: 'ACTIVE' | 'PAUSED' };
    }>(`/offers/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ expectedVersion, status }),
    }),
  updateStandaloneSalePrice: (
    id: string,
    input: TicketStandaloneSalePriceUpdateV1,
    key: string,
  ) =>
    request<{
      data: { revision: number; amount: string; currencyCode: string };
    }>(`/offers/${id}/standalone-sale-price`, {
      method: 'PATCH',
      headers: { 'idempotency-key': key },
      body: JSON.stringify(input),
    }),
  updateRoundTripSalePrice: (
    outboundOfferId: string,
    returnOfferId: string,
    input: TicketRoundTripSalePriceUpdateV1,
    key: string,
  ) =>
    request<{
      data: { revision: number; amount: string; currencyCode: string };
    }>(`/offers/${outboundOfferId}/round-trip-sale-price/${returnOfferId}`, {
      method: 'PATCH',
      headers: { 'idempotency-key': key },
      body: JSON.stringify(input),
    }),
  publishOffer: (input: TicketOfferCreateV1, branch: string, key: string) =>
    request<{ data: { id: string } }>('/offers', post(input, branch, key)),
  temporaryHold: (
    offerId: string,
    input: { quantity: number; expiresAt: string; requesterName?: string },
    branch: string,
    key: string,
  ) =>
    request<{
      data: { id: string; quantity: number; expiresAt: string; status: string };
    }>(`/offers/${offerId}/capacity-holds`, post(input, branch, key)),
};
