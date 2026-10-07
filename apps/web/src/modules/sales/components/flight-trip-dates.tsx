'use client';
import { useEffect, useState } from 'react';
import type { TicketOfferSearchV1, TicketOfferV1 } from '@nora/contracts';
import { DatePicker } from '@/components/ui/date-picker';
import { searchTickets } from '../api/ticket-search';
import { salesFlightToday } from '../model/sales-flight-range';
import { eligibleReturn, flightDay } from '../model/exact-flight-dates';
import type { FlightDateRange } from './flight-date-range';

export async function flightCalendarOffers(
  query: TicketOfferSearchV1,
  signal: AbortSignal,
) {
  const offers: TicketOfferV1[] = [];
  const ids = new Set<string>();
  for (let page = 1; page <= 10000; page++) {
    signal.throwIfAborted();
    const result = await searchTickets({ ...query, page }, signal);
    if (!Array.isArray(result.data) || (result.hasMore && !result.data.length))
      throw new Error('دریافت روزهای پرواز کامل نشد. دوباره تلاش کنید.');
    for (const offer of result.data) {
      if (ids.has(offer.id))
        throw new Error('فهرست پرواز تغییر کرد. دوباره تلاش کنید.');
      ids.add(offer.id);
      offers.push(offer);
    }
    if (!result.hasMore) return offers;
  }
  throw new Error('فهرست پرواز کامل دریافت نشد.');
}

export function FlightTripDates({
  originId,
  international = false,
  destinationId,
  roundTrip,
  seats,
  requireFare,
  value,
  onChange,
}: {
  originId: string;
  international?: boolean;
  destinationId: string;
  roundTrip: boolean;
  seats: number;
  requireFare: boolean;
  value: FlightDateRange;
  onChange: (value: FlightDateRange, outboundIds?: string[]) => void;
}) {
  const [result, setResult] = useState<{
    key: string;
    outbound: TicketOfferV1[];
    returning: TicketOfferV1[];
  }>({ key: '', outbound: [], returning: [] });
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify({
    originId,
    destinationId,
    roundTrip,
    seats,
    requireFare,
  });
  const readyRoute = Boolean(
    originId && destinationId && originId !== destinationId,
  );
  useEffect(() => {
    if (!readyRoute) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setError('');
      const base = { departureFrom: new Date().toISOString() };
      void Promise.all([
        flightCalendarOffers(
          { ...base, originId, destinationId },
          controller.signal,
        ),
        roundTrip
          ? flightCalendarOffers(
              { ...base, originId: destinationId, destinationId: originId },
              controller.signal,
            )
          : Promise.resolve([]),
      ])
        .then(([outbound, returning]) => {
          if (!controller.signal.aborted)
            setResult({ key, outbound, returning });
        })
        .catch((cause: unknown) => {
          if (!controller.signal.aborted)
            setError(
              cause instanceof Error
                ? cause.message
                : 'دریافت روزهای پرواز ناموفق بود.',
            );
        });
    }, 0);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, readyRoute, originId, destinationId, roundTrip, attempt]);
  const current = result.key === key;
  const saleable = (offer: TicketOfferV1) =>
    offer.status === 'ACTIVE' &&
    offer.remainingCapacity >= seats &&
    flightDay(offer) >= salesFlightToday();
  const outbound = current
    ? result.outbound.filter(
        (offer) =>
          saleable(offer) &&
          (!requireFare ||
            offer.standaloneSalePrice ||
            (roundTrip && offer.roundTripSalePrices?.length)),
      )
    : [];
  const days = [...new Set(outbound.map(flightDay))];
  const selectedOutbound = outbound.filter(
    (offer) => flightDay(offer) === value.from,
  );
  const returns = current
    ? result.returning.filter(
        (offer) =>
          saleable(offer) &&
          (!selectedOutbound.length ||
            selectedOutbound.some(
              (out) =>
                eligibleReturn(out, offer) &&
                (!requireFare ||
                  out.roundTripSalePrices?.some(
                    (fare) => fare.returnOfferId === offer.id,
                  )),
            )),
      )
    : [];
  const returnDays = [...new Set(returns.map(flightDay))];
  const canPair = (out: TicketOfferV1, offer: TicketOfferV1) =>
    eligibleReturn(out, offer) &&
    (!requireFare ||
      out.roundTripSalePrices?.some((fare) => fare.returnOfferId === offer.id));
  return (
    <div className="grid gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          بلیط رفت
          <DatePicker
            key={international ? 'foreign' : 'local'}
            defaultCalendarSystem={international ? 'gregorian' : undefined}
            gregorianEnglish
            value={value.from}
            markedDates={days}
            minimumDate={salesFlightToday()}
            disabled={!readyRoute}
            aria-label="تاریخ بلیط رفت"
            onChange={(from) => onChange({ from, to: roundTrip ? '' : from })}
          />
        </label>
        {roundTrip ? (
          <label className="grid gap-2 text-sm font-semibold">
            بلیط برگشت
            <DatePicker
              key={international ? 'foreign' : 'local'}
              defaultCalendarSystem={international ? 'gregorian' : undefined}
              gregorianEnglish
              value={value.to}
              markedDates={returnDays}
              minimumDate={value.from || salesFlightToday()}
              disabled={!readyRoute || !value.from}
              aria-label="تاریخ بلیط برگشت"
              onChange={(to) => {
                const pairedOutboundIds = selectedOutbound
                  .filter((out) =>
                    returns.some(
                      (offer) => flightDay(offer) === to && canPair(out, offer),
                    ),
                  )
                  .map((out) => out.id);
                onChange(
                  { ...value, to },
                  pairedOutboundIds.length ? pairedOutboundIds : undefined,
                );
              }}
            />
          </label>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        نقطهٔ قرمز تاریخ بلیط‌های ثبت‌شدهٔ قابل فروش در این مسیر را نشان می‌دهد؛
        روزهای بدون نقطه نیز برای بلیط شناور قابل انتخاب‌اند.
      </p>
      {!readyRoute ? (
        <p className="text-sm">ابتدا مبدأ و مقصد را انتخاب کنید.</p>
      ) : error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}{' '}
          <button
            type="button"
            className="underline"
            onClick={() => setAttempt((n) => n + 1)}
          >
            تلاش دوباره
          </button>
        </p>
      ) : !current ? (
        <p role="status" className="text-sm">
          در حال دریافت روزهای پرواز…
        </p>
      ) : !days.length ? (
        <p className="text-sm">پرواز قابل فروش برای این مسیر پیدا نشد.</p>
      ) : roundTrip && value.from && !returnDays.length ? (
        <p className="text-sm">برای این روز رفت، برگشت مجاز پیدا نشد.</p>
      ) : null}
    </div>
  );
}
