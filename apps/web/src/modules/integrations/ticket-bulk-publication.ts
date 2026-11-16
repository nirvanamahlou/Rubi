import type { TicketOfferV1 } from '@nora/contracts';
import {
  filterTicketRows,
  ticketPriceRows,
} from '@/modules/sales/model/ticket-price-rows';
import { websiteDestinations } from './site-publication-model';

export type TicketPublicationFilters = {
  originId: string;
  destinationId: string;
  tripType: string;
  from: string;
  to: string;
  query: string;
};
export function matchingPublicationTickets(
  tickets: TicketOfferV1[],
  branchId: string,
  filters: TicketPublicationFilters,
  label: (offer: TicketOfferV1) => string,
) {
  const active = tickets.filter(
    (offer) => offer.branchId === branchId && offer.status === 'ACTIVE',
  );
  const rows = filterTicketRows(ticketPriceRows(active), filters, label).filter(
    (row) =>
      Number(row.base?.amount) > 0 && (!row.returnOfferId || row.returning),
  );
  const ids = new Set(rows.map((row) => row.offer.id));
  return active.filter((offer) => ids.has(offer.id));
}
export function completePublicationFilters(filters: TicketPublicationFilters) {
  const date = (value: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  return Boolean(
    filters.originId &&
    filters.destinationId &&
    ['ONEWAY', 'ROUNDTRIP'].includes(filters.tripType) &&
    date(filters.from) &&
    date(filters.to) &&
    filters.from <= filters.to,
  );
}
export type TicketPublicationResult = {
  resourceId: string;
  site: string;
  status: 'saved' | 'already' | 'stopped' | 'failed';
  message?: string;
};
type Publication = {
  enabled: boolean;
  version: number;
  salesStopped?: boolean;
};
/** Sequential native CAS commands; no blind retries and no overwriting site settings. */
export async function publishTicketSelection(input: {
  branchId: string;
  resourceIds: string[];
  sites: string[];
  baseUrl: string;
  fetch: typeof fetch;
  signal: AbortSignal;
  onProgress?: (results: TicketPublicationResult[]) => void;
}) {
  const results: TicketPublicationResult[] = [];
  const sites = [...new Set(input.sites)];
  if (
    !input.branchId ||
    !sites.length ||
    sites.some(
      (site) => !websiteDestinations.some((item) => item.code === site),
    )
  )
    throw Error('انتخاب سایت معتبر نیست.');
  let accessDenied = false;
  for (const resourceId of new Set(input.resourceIds)) {
    for (const site of sites) {
      if (input.signal.aborted) return results;
      let status: TicketPublicationResult['status'] = 'failed';
      let message: string | undefined;
      try {
        if (accessDenied) throw Error('به‌علت خطای دسترسی اجرا نشد.');
        const path = `${input.baseUrl}/sales/site-commerce/v1/${site}/publications/ticket/${encodeURIComponent(resourceId)}`;
        const response = await input.fetch(
          `${path}?${new URLSearchParams({ branchId: input.branchId })}`,
          {
            credentials: 'include',
            cache: 'no-store',
            signal: input.signal,
          },
        );
        if ([401, 403].includes(response.status)) accessDenied = true;
        const value = await response.json();
        if (input.signal.aborted) return results;
        if (!response.ok)
          throw Error(
            value.error?.message ?? value.message ?? 'وضعیت انتشار دریافت نشد.',
          );
        const stored: Publication = value.data ?? {
          enabled: false,
          version: 0,
        };
        if (
          !Number.isInteger(stored.version) ||
          stored.version < 0 ||
          typeof stored.enabled !== 'boolean'
        )
          throw Error('وضعیت انتشار دریافت نشد.');
        if (stored.salesStopped) status = 'stopped';
        else if (stored.enabled) status = 'already';
        else {
          if (input.signal.aborted) return results;
          const saved = await input.fetch(path, {
            method: 'POST',
            credentials: 'include',
            signal: input.signal,
            headers: {
              'content-type': 'application/json',
              'x-nora-site-commerce': '1',
            },
            body: JSON.stringify({
              enabled: true,
              version: stored.version,
              branchId: input.branchId,
            }),
          });
          if ([401, 403].includes(saved.status)) accessDenied = true;
          const body = await saved.json();
          if (input.signal.aborted) return results;
          if (!saved.ok)
            throw Error(
              body.error?.message ?? body.message ?? 'ثبت انتشار ناموفق بود.',
            );
          if (body.data?.enabled !== true)
            throw Error('ثبت انتشار ناموفق بود.');
          status = 'saved';
        }
      } catch (cause) {
        if (input.signal.aborted) return results;
        message =
          cause instanceof Error ? cause.message : 'ثبت انتشار ناموفق بود.';
      }
      results.push({
        resourceId,
        site,
        status,
        ...(message ? { message } : {}),
      });
      input.onProgress?.([...results]);
    }
  }
  return results;
}
