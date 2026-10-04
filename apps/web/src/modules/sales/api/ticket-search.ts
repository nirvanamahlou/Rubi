import type { TicketOfferSearchV1, TicketOfferV1 } from '@nora/contracts';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
export type TicketSearchResult = { data: TicketOfferV1[]; hasMore: boolean };
export type PreparedTicketSearch = {
  key: string;
  startedAt: number;
  signal: AbortSignal;
  result: Promise<TicketSearchResult>;
};
export function ticketSearchKey(query: TicketOfferSearchV1) {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(query)
        .filter(([, v]) => v != null)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}
export async function searchTickets(
  query: TicketOfferSearchV1,
  signal: AbortSignal,
): Promise<TicketSearchResult> {
  const base = getPublicApiBaseUrl();
  if (!base) throw new Error('اتصال به سرور تنظیم نشده است.');
  const params = new URLSearchParams(
    Object.entries(query)
      .filter(([, value]) => value != null)
      .map(([key, value]) => [key, String(value)]),
  );
  const get = () =>
    fetch(base + '/ticket-catalog/offers?' + params, {
      credentials: 'include',
      signal,
      cache: 'no-store',
    });
  let response = await get();
  if (response.status === 401 && (await refreshAuthenticatedSession(base)))
    response = await get();
  if (!response.ok)
    throw new Error('دریافت بلیط‌ها ناموفق بود؛ دسترسی و اتصال را بررسی کنید.');
  return response.json() as Promise<TicketSearchResult>;
}
export function prepareTicketSearch(
  query: TicketOfferSearchV1,
  signal: AbortSignal,
): PreparedTicketSearch {
  const result = searchTickets(query, signal);
  // A speculative request must never produce an unhandled rejection.
  void result.catch(() => undefined);
  return { key: ticketSearchKey(query), startedAt: Date.now(), signal, result };
}
export function readyTicketSearch(
  query: TicketOfferSearchV1,
  prepared?: PreparedTicketSearch,
) {
  return prepared &&
    !prepared.signal.aborted &&
    Date.now() - prepared.startedAt < 10000 &&
    prepared.key === ticketSearchKey(query)
    ? prepared.result
    : undefined;
}
