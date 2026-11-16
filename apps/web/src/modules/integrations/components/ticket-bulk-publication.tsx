'use client';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { localizedFetch } from '@/i18n/localized-fetch';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { websiteDestinations } from '../site-publication-model';
import {
  completePublicationFilters,
  publishTicketSelection,
  type TicketPublicationFilters,
  type TicketPublicationResult,
} from '../ticket-bulk-publication';

export function TicketBulkPublication({
  branchId,
  filters,
  tickets,
  loading,
  onBusy,
  onComplete,
}: {
  branchId: string;
  filters: TicketPublicationFilters;
  tickets: { id: string; title: string }[];
  loading: boolean;
  onBusy: (busy: boolean) => void;
  onComplete: () => void;
}) {
  const [sites, setSites] = useState<string[]>([]);
  const [plan, setPlan] = useState<{
    key: string;
    tickets: typeof tickets;
    sites: string[];
  }>();
  const [results, setResults] = useState<TicketPublicationResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const running = useRef(false);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  const apiBase = getPublicApiBaseUrl();
  const key = JSON.stringify([
    branchId,
    filters,
    tickets.map((ticket) => ticket.id),
    sites,
  ]);
  const ready =
    Boolean(apiBase) &&
    !loading &&
    Boolean(branchId) &&
    completePublicationFilters(filters) &&
    tickets.length > 0 &&
    sites.length > 0;
  const currentPlan = plan?.key === key ? plan : undefined;
  async function publish() {
    if (!currentPlan || !ready || !apiBase || running.current) return;
    running.current = true;
    setBusy(true);
    onBusy(true);
    setResults([]);
    setError('');
    const controller = new AbortController();
    abort.current = controller;
    try {
      await publishTicketSelection({
        branchId,
        resourceIds: currentPlan.tickets.map((ticket) => ticket.id),
        sites: currentPlan.sites,
        baseUrl: apiBase,
        fetch: localizedFetch,
        signal: controller.signal,
        onProgress: setResults,
      });
    } catch (cause) {
      if (!controller.signal.aborted)
        setError(
          cause instanceof Error ? cause.message : 'ثبت انتشار ناموفق بود.',
        );
    } finally {
      running.current = false;
      if (!controller.signal.aborted) {
        setBusy(false);
        onBusy(false);
        setPlan(undefined);
        onComplete();
      }
    }
  }
  const names = Object.fromEntries(
    websiteDestinations.map((site) => [site.code, site.name]),
  );
  const titles = Object.fromEntries(
    tickets.map((ticket) => [ticket.id, ticket.title]),
  );
  return (
    <section
      className="grid gap-3 rounded-2xl border border-primary/25 bg-surface p-4"
      aria-label="انتشار گروهی بلیط‌ها"
      aria-busy={busy}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold text-primary">انتشار گروهی بلیط‌ها</h2>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-sm">
          بلیت‌های مطابق فیلتر: {tickets.length}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        مبدأ، مقصد، نوع بلیط و بازهٔ تاریخ را در فیلترهای بالا مشخص کنید؛ سپس
        سایت‌ها را انتخاب کنید.
      </p>
      <div className="flex flex-wrap gap-3">
        {websiteDestinations.map((site) => (
          <label
            key={site.code}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              checked={sites.includes(site.code)}
              disabled={busy}
              onChange={(event) =>
                setSites((old) =>
                  event.target.checked
                    ? [...old, site.code]
                    : old.filter((code) => code !== site.code),
                )
              }
            />
            {site.name}
            {!site.connected ? (
              <small className="text-amber-700">در انتظار اتصال</small>
            ) : null}
          </label>
        ))}
      </div>
      {!currentPlan ? (
        <div>
          <Button
            type="button"
            variant="outline"
            disabled={!ready || busy}
            onClick={() => {
              setPlan({ key, tickets: [...tickets], sites: [...sites] });
              setResults([]);
            }}
          >
            بررسی انتشار گروهی
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 rounded-xl bg-primary/5 p-3">
          <p className="font-semibold">
            {currentPlan.tickets.length} بلیت ·{' '}
            {currentPlan.sites.map((site) => names[site]).join('، ')}
          </p>
          <p className="text-sm">
            انتشارهای قبلی و توقف فروش حفظ می‌شوند؛ سایت‌های دیگر تغییری
            نمی‌کنند.
          </p>
          <details>
            <summary className="cursor-pointer text-sm">
              مشاهده بلیت‌های انتخاب‌شده
            </summary>
            <ul className="mt-2 max-h-48 overflow-auto text-sm">
              {currentPlan.tickets.map((ticket) => (
                <li key={ticket.id} className="py-1" dir="auto">
                  {ticket.title}
                </li>
              ))}
            </ul>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={busy || !ready}
              onClick={() => void publish()}
            >
              تأیید و انتشار گروهی
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => setPlan(undefined)}
            >
              انصراف
            </Button>
          </div>
        </div>
      )}
      {busy ? (
        <p role="status">
          در حال ثبت… {results.length} /{' '}
          {(plan?.tickets.length ?? 0) * (plan?.sites.length ?? 0)}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
      {results.length ? (
        <div aria-live="polite" className="grid gap-2 text-sm">
          <p>
            ثبت‌شده: {results.filter((item) => item.status === 'saved').length}{' '}
            · از قبل فعال:{' '}
            {results.filter((item) => item.status === 'already').length} · توقف
            فروش: {results.filter((item) => item.status === 'stopped').length} ·
            ناموفق: {results.filter((item) => item.status === 'failed').length}
          </p>
          <details>
            <summary className="cursor-pointer">جزئیات نتیجهٔ انتشار</summary>
            <ul className="mt-2 max-h-64 overflow-auto">
              {results.map((item) => (
                <li
                  key={item.site + ':' + item.resourceId}
                  className="border-b border-border py-2"
                  dir="auto"
                >
                  {titles[item.resourceId] ?? item.resourceId} ·{' '}
                  {names[item.site]} ·{' '}
                  {item.status === 'failed'
                    ? item.message
                    : item.status === 'stopped'
                      ? 'توقف فروش حفظ شد'
                      : item.status === 'already'
                        ? 'از قبل فعال'
                        : websiteDestinations.find(
                              (site) => site.code === item.site,
                            )?.connected
                          ? 'انتشار فعال'
                          : 'در انتظار اتصال'}
                </li>
              ))}
            </ul>
          </details>
        </div>
      ) : null}
    </section>
  );
}
