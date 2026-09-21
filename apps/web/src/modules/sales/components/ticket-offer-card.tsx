'use client';

import { CheckCircle2, Circle, Plane } from 'lucide-react';
import type { TicketOfferV1 } from '@nora/contracts';

export function ticketDisplayTime(value: string) {
  const date = new Date(value);
  return {
    time: new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date),
    date: new Intl.DateTimeFormat('fa-IR', {
      timeZone: 'Asia/Tehran',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date),
  };
}

export function ticketDuration(
  offer: Pick<TicketOfferV1, 'departureAt' | 'arrivalAt'>,
) {
  const minutes = Math.round(
    (Date.parse(offer.arrivalAt) - Date.parse(offer.departureAt)) / 60000,
  );
  if (!Number.isFinite(minutes) || minutes < 0) return '—';
  const number = (value: number) =>
    new Intl.NumberFormat('fa-IR').format(value);
  return (
    [
      Math.floor(minutes / 60)
        ? `${number(Math.floor(minutes / 60))} ساعت`
        : '',
      minutes % 60 ? `${number(minutes % 60)} دقیقه` : '',
    ]
      .filter(Boolean)
      .join(' و ') || '۰ دقیقه'
  );
}

export function TicketOfferCard({
  offer,
  selected,
  onSelect,
  originLabel = 'مبدأ',
  destinationLabel = 'مقصد',
  requiredSeats = 1,
  requireStandaloneFare = false,
}: {
  offer: TicketOfferV1;
  selected: boolean;
  onSelect: (offer: TicketOfferV1) => void;
  originLabel?: string;
  destinationLabel?: string;
  requiredSeats?: number;
  requireStandaloneFare?: boolean;
}) {
  const departure = ticketDisplayTime(offer.departureAt);
  const insufficient = offer.remainingCapacity < requiredSeats;
  const missingFare = requireStandaloneFare && !offer.standaloneSalePrice;
  const arrival = ticketDisplayTime(offer.arrivalAt);
  const arrivesOnAnotherDay = arrival.date !== departure.date;
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={insufficient || missingFare}
      aria-label={`${offer.carrierName}، پرواز ${offer.serviceNumber}، ${originLabel} به ${destinationLabel}، ${departure.date} ساعت ${departure.time}${selected ? '، انتخاب‌شده' : ''}`}
      onClick={() => onSelect(offer)}
      className={`w-full min-w-0 disabled:cursor-not-allowed disabled:opacity-60 overflow-hidden rounded-2xl border text-start shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${selected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-surface hover:border-primary/60 hover:shadow-md'}`}
    >
      <span className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
        <span className="min-w-0">
          <span className="flex items-center gap-2 break-words text-base font-bold text-foreground">
            <Plane
              aria-hidden="true"
              className="size-5 shrink-0 text-primary"
            />
            {offer.carrierName}
          </span>
          <span className="mt-1.5 block text-xs text-muted-foreground">
            شماره پرواز{' '}
            <bdi className="font-semibold">{offer.serviceNumber}</bdi>
          </span>
          <span
            data-ticket-meta="travel-dates"
            className="mt-2 flex flex-wrap items-center gap-1.5 text-lg font-extrabold leading-7 text-primary"
          >
            <time dateTime={offer.departureAt}>{departure.date}</time>
            {arrivesOnAnotherDay ? (
              <>
                <span aria-hidden="true" className="text-muted-foreground">
                  ←
                </span>
                <time dateTime={offer.arrivalAt}>{arrival.date}</time>
              </>
            ) : null}
          </span>
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-bold ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
        >
          {selected ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Circle className="size-4" />
          )}
          {selected ? 'انتخاب‌شده' : 'انتخاب'}
        </span>
      </span>
      <span className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-4 py-3">
        <span className="min-w-0 text-start">
          <span className="block text-xs text-muted-foreground">حرکت</span>
          <span className="mt-1 block break-words text-lg font-bold text-foreground">
            {originLabel}
          </span>
          <strong
            dir="ltr"
            data-ticket-time="departure"
            className="mt-1.5 block text-start text-base font-semibold tabular-nums text-muted-foreground"
          >
            {departure.time}
          </strong>
        </span>
        <span className="flex max-w-32 flex-col items-center gap-1 rounded-lg bg-muted/60 px-2 py-2 text-center text-[11px] leading-5 text-muted-foreground">
          <Plane
            aria-hidden="true"
            className="size-4 -rotate-45 text-primary"
          />
          <span>مدت پرواز: {ticketDuration(offer)}</span>
          <span>ساعت‌ها به وقت تهران</span>
        </span>
        <span className="min-w-0 text-end">
          <span className="block text-xs text-muted-foreground">رسیدن</span>
          <span className="mt-1 block break-words text-lg font-bold text-foreground">
            {destinationLabel}
          </span>
          <strong
            dir="ltr"
            data-ticket-time="arrival"
            className="mt-1.5 block text-end text-base font-semibold tabular-nums text-muted-foreground"
          >
            {arrival.time}
          </strong>
        </span>
      </span>
      <span className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/40 px-4 py-3 text-xs">
        <span>
          {offer.cabinClassCode === 'BUSINESS'
            ? 'بیزینس'
            : offer.cabinClassCode === 'FIRST'
              ? 'فرست'
              : 'اکونومی'}
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1">
          {requireStandaloneFare ? (
            <strong className={missingFare ? 'text-rose-600' : ''}>
              {offer.standaloneSalePrice
                ? `فروش تکی هر صندلی: ${offer.standaloneSalePrice.amount} ${offer.standaloneSalePrice.currencyCode}`
                : 'قیمت فروش تکی ثبت نشده'}
            </strong>
          ) : null}
          <span>
            ظرفیت کل:{' '}
            {new Intl.NumberFormat('fa-IR').format(offer.totalCapacity)} نفر
          </span>
          <strong className={insufficient ? 'text-rose-600' : ''}>
            مانده:{' '}
            {new Intl.NumberFormat('fa-IR').format(offer.remainingCapacity)} نفر
          </strong>
          {insufficient ? (
            <span className="w-full text-rose-600">
              برای {new Intl.NumberFormat('fa-IR').format(requiredSeats)} صندلی
              کافی نیست
            </span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
