'use client';

import { useEffect, useState } from 'react';
import type { TicketOfferSearchV1, TicketOfferV1 } from '@nora/contracts';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/surfaces';
import {
  readyTicketSearch,
  searchTickets,
  type PreparedTicketSearch,
} from '../api/ticket-search';
import { TicketOfferCard } from './ticket-offer-card';

export function TicketOfferPicker({
  query,
  prepared,
  enabled = true,
  selectedId,
  onSelect,
  originLabel,
  destinationLabel,
  requiredSeats,
  requireStandaloneFare = false,
  roundTripOutbound,
  acceptAnyRoundTripFare = false,
}: {
  query: TicketOfferSearchV1;
  prepared?: PreparedTicketSearch;
  enabled?: boolean;
  selectedId: string;
  onSelect: (offer: TicketOfferV1) => void;
  originLabel?: string;
  destinationLabel?: string;
  requiredSeats: number;
  requireStandaloneFare?: boolean;
  roundTripOutbound?: TicketOfferV1;
  acceptAnyRoundTripFare?: boolean;
}) {
  const [offers, setOffers] = useState<TicketOfferV1[]>([]);
  const [pagination, setPagination] = useState({ filters: '', page: 1 });
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const filters = JSON.stringify({
    ...query,
    ...(roundTripOutbound ? { outboundOfferId: roundTripOutbound.id } : {}),
  });
  const page = pagination.filters === filters ? pagination.page : 1;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setBusy(true);
      setError('');
      const searchQuery = {
        ...JSON.parse(filters),
        page,
      } as TicketOfferSearchV1;
      void (async () => {
        const result = await (readyTicketSearch(searchQuery, prepared)?.catch(
          () => {
            controller.signal.throwIfAborted();
            return searchTickets(searchQuery, controller.signal);
          },
        ) ?? searchTickets(searchQuery, controller.signal));
        if (controller.signal.aborted) return;
        setOffers(result.data);
        setHasMore(result.hasMore);
      })()
        .catch((reason: unknown) => {
          if (!controller.signal.aborted)
            setError(
              reason instanceof Error
                ? reason.message
                : 'دریافت بلیط ناموفق بود.',
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
  }, [filters, page, enabled, prepared]);
  if (!enabled)
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        ابتدا بازه تاریخ را انتخاب و تأیید کنید تا بلیط‌ها نمایش داده شوند.
      </p>
    );
  return (
    <div className="grid gap-3">
      <p className="text-[11px] text-muted-foreground">
        ساعت‌ها به وقت تهران · مرتب‌شده از نزدیک‌ترین تاریخ
      </p>
      {roundTripOutbound &&
      (roundTripOutbound.returnMinDays != null ||
        roundTripOutbound.returnMaxDays != null) ? (
        <p className="text-sm text-primary">
          فاصله برگشت از رفت: حداقل {roundTripOutbound.returnMinDays ?? 0} روز ·
          حداکثر {roundTripOutbound.returnMaxDays ?? 'بدون محدودیت'} روز
        </p>
      ) : null}
      {busy ? (
        <p>در حال جست‌وجوی بلیط…</p>
      ) : error ? (
        <Alert tone="error" title={error} />
      ) : !offers.length ? (
        <p>بلیطی برای این مسیر و تاریخ پیدا نشد.</p>
      ) : (
        offers.map((offer) => (
          <TicketOfferCard
            key={offer.id}
            offer={offer}
            selected={selectedId === offer.id}
            requiredSeats={requiredSeats}
            requireStandaloneFare={
              requireStandaloneFare &&
              !(acceptAnyRoundTripFare && offer.roundTripSalePrices?.length) &&
              !roundTripOutbound?.roundTripSalePrices?.some(
                (price) => price.returnOfferId === offer.id,
              )
            }
            {...(roundTripOutbound ? { roundTripOutbound } : {})}
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
            onClick={() => setPagination({ filters, page: page - 1 })}
          >
            صفحه قبل
          </Button>
        ) : null}
        {hasMore ? (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setPagination({ filters, page: page + 1 })}
          >
            بلیط‌های بیشتر
          </Button>
        ) : null}
      </div>
    </div>
  );
}
