'use client';

import { useEffect, useState } from 'react';
import type { TicketOfferSearchV1, TicketOfferV1 } from '@rubi/contracts';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/surfaces';
import { getPublicApiBaseUrl } from '@/lib/environment';
import { refreshAuthenticatedSession } from '@/lib/auth-session';
import { TicketOfferCard } from './ticket-offer-card';

export function TicketOfferPicker({
  query,
  selectedId,
  onSelect,
  originLabel,
  destinationLabel,
}: {
  query: TicketOfferSearchV1;
  selectedId: string;
  onSelect: (offer: TicketOfferV1) => void;
  originLabel?: string;
  destinationLabel?: string;
}) {
  const [offers, setOffers] = useState<TicketOfferV1[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const filters = JSON.stringify(query);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      setError('');
      const params = new URLSearchParams({
        ...JSON.parse(filters),
        page: String(page),
      });
      void (async () => {
        const base = getPublicApiBaseUrl();
        if (!base) throw new Error('اتصال به سرور تنظیم نشده است.');
        const get = () =>
          fetch(`${base}/ticket-catalog/offers?${params}`, {
            credentials: 'include',
            signal: controller.signal,
            cache: 'no-store',
          });
        let response = await get();
        if (
          response.status === 401 &&
          (await refreshAuthenticatedSession(base))
        )
          response = await get();
        if (!response.ok)
          throw new Error(
            'دریافت بلیت‌ها ناموفق بود؛ دسترسی و اتصال را بررسی کنید.',
          );
        const result = (await response.json()) as {
          data: TicketOfferV1[];
          hasMore: boolean;
        };
        setOffers(result.data);
        setHasMore(result.hasMore);
      })()
        .catch((reason: unknown) => {
          if (!controller.signal.aborted)
            setError(
              reason instanceof Error
                ? reason.message
                : 'دریافت بلیت ناموفق بود.',
            );
        })
        .finally(() => {
          if (!controller.signal.aborted) setBusy(false);
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filters, page]);
  return (
    <div className="grid gap-3">
      <p className="text-[11px] text-muted-foreground">
        ساعت‌ها به وقت تهران · مرتب‌شده از نزدیک‌ترین تاریخ
      </p>
      {busy ? (
        <p>در حال جست‌وجوی بلیت…</p>
      ) : error ? (
        <Alert tone="error" title={error} />
      ) : !offers.length ? (
        <p>بلیتی برای این مسیر و تاریخ پیدا نشد.</p>
      ) : (
        offers.map((offer) => (
          <TicketOfferCard
            key={offer.id}
            offer={offer}
            selected={selectedId === offer.id}
            onSelect={onSelect}
            {...(originLabel ? { originLabel } : {})}
            {...(destinationLabel ? { destinationLabel } : {})}
          />
        ))
      )}
      <div className="flex gap-2">
        {page > 1 ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setPage(page - 1)}
          >
            صفحه قبل
          </Button>
        ) : null}
        {hasMore ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setPage(page + 1)}
          >
            بلیت‌های بیشتر
          </Button>
        ) : null}
      </div>
    </div>
  );
}
