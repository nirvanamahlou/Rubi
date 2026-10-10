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
import { flightDay } from '../model/exact-flight-dates';

export function TicketOfferPicker({
  query,
  prepared,
  exactDay,
  allowedOfferIds,
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
  prepared?: PreparedTicketSearch | undefined;
  exactDay?: string | undefined;
  allowedOfferIds?: readonly string[] | undefined;
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
        setOffers(
          result.data.filter(
            (offer) =>
              (!exactDay || flightDay(offer) === exactDay) &&
              (!allowedOfferIds || allowedOfferIds.includes(offer.id)),
          ),
        );
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
  }, [filters, page, enabled, prepared, exactDay, allowedOfferIds]);
  if (!enabled)
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        ابتدا تاریخ بلیط را انتخاب کنید تا پروازهای همان روز نمایش داده شوند.
      </p>
    );
  return (
    <div className="grid gap-3">
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
