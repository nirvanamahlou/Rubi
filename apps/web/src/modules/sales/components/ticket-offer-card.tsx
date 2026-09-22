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
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={insufficient || missingFare}
      aria-label={`${offer.carrierName}، پرواز ${offer.serviceNumber}، ${originLabel} به ${destinationLabel}، ${departure.date} ساعت ${departure.time}${selected ? '، انتخاب‌شده' : ''}`}
      onClick={() => onSelect(offer)}
      className={`w-full min-w-0 disabled:cursor-not-allowed disabled:opacity-60 overflow-hidden rounded-xl border text-start shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${selected ? 'border-primary bg-primary/5 ring-2 ring-primary/20' : 'border-border bg-surface hover:border-primary/60 hover:shadow-md'}`}
    >
      <span className="flex items-start justify-between gap-3 border-b border-border/60 px-3 py-2.5">
        <span className="min-w-0">
          <span className="flex items-center gap-2 break-words text-sm font-bold text-foreground">
            <Plane
              aria-hidden="true"
              className="size-4 shrink-0 text-primary"
            />
            {offer.carrierName}
          </span>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            شماره پرواز{' '}
            <bdi className="font-semibold">{offer.serviceNumber}</bdi>
          </span>
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}
        >
          {selected ? (
            <CheckCircle2 className="size-3.5" />
          ) : (
            <Circle className="size-3.5" />
          )}
          {selected ? 'انتخاب‌شده' : 'انتخاب'}
        </span>
      </span>
      <span className="grid grid-cols-2 items-start gap-x-4 gap-y-2 px-3 py-2.5">
        <span className="min-w-0">
          <span className="block text-[11px] text-muted-foreground">حرکت</span>
          <span className="mt-0.5 block break-words text-base font-bold text-foreground">
            {originLabel}
          </span>
          <span className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <time
              dateTime={offer.departureAt}
              className="break-words text-base font-bold leading-5 text-foreground"
            >
              {departure.date}
            </time>
            <strong
              dir="ltr"
              className="text-sm font-semibold tabular-nums text-primary"
            >
              {departure.time}
            </strong>
          </span>
        </span>
        <span className="min-w-0 text-end">
          <span className="block text-[11px] text-muted-foreground">رسیدن</span>
          <span className="mt-0.5 block break-words text-base font-bold text-foreground">
            {destinationLabel}
          </span>
          <span className="mt-1.5 flex flex-wrap items-baseline justify-end gap-x-2 gap-y-1">
            <time
              dateTime={offer.arrivalAt}
              className="break-words text-base font-bold leading-5 text-foreground"
            >
              {arrival.date}
            </time>
            <strong
              dir="ltr"
              className="text-sm font-semibold tabular-nums text-primary"
            >
              {arrival.time}
            </strong>
          </span>
        </span>
        <span className="col-span-2 flex items-center justify-center gap-1.5 rounded-md bg-muted/60 px-2 py-1.5 text-[11px] text-muted-foreground">
          <Plane
            aria-hidden="true"
            className="size-3.5 -rotate-45 text-primary"
          />
          مدت پرواز: {ticketDuration(offer)} · ساعت‌ها به وقت تهران
        </span>
      </span>
      <span className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/40 px-3 py-2 text-[11px]">
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
