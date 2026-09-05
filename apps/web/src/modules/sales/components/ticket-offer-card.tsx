'use client';

import { CheckCircle2, Circle, Plane } from 'lucide-react';
import type { TicketOfferV1 } from '@rubi/contracts';

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
}: {
  offer: TicketOfferV1;
  selected: boolean;
  onSelect: (offer: TicketOfferV1) => void;
  originLabel?: string;
  destinationLabel?: string;
}) {
  const departure = ticketDisplayTime(offer.departureAt);
  const arrival = ticketDisplayTime(offer.arrivalAt);
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`${offer.carrierName}، پرواز ${offer.serviceNumber}، ${originLabel} به ${destinationLabel}، ${departure.date} ساعت ${departure.time}${selected ? '، انتخاب‌شده' : ''}`}
      onClick={() => onSelect(offer)}
      className={`w-full overflow-hidden rounded-2xl border text-start shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-border bg-surface hover:border-primary/60 hover:shadow-md'}`}
    >
      <span className="flex items-start justify-between gap-3 px-4 pt-3">
        <span className="min-w-0">
          <span className="block break-words text-sm font-bold">
            {offer.carrierName}
          </span>
          <span
            className={`mt-1 block text-xs ${selected ? 'text-white/80' : 'text-muted-foreground'}`}
          >
            شماره پرواز{' '}
            <bdi className="font-semibold">{offer.serviceNumber}</bdi>
          </span>
        </span>
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${selected ? 'bg-white/20' : 'bg-primary/5 text-primary'}`}
        >
          {selected ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <Circle className="size-4" />
          )}
          {selected ? 'انتخاب‌شده' : 'انتخاب'}
        </span>
      </span>
      <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 py-4">
        <span className="min-w-0">
          <span className="block text-[11px] opacity-75">حرکت</span>
          <strong
            dir="ltr"
            className="block text-start text-2xl font-black tabular-nums"
          >
            {departure.time}
          </strong>
          <span className="block truncate text-sm font-bold">
            {originLabel}
          </span>
          <span className="mt-1 block text-[11px] opacity-80">
            {departure.date}
          </span>
        </span>
        <span className="grid justify-items-center gap-2 text-center">
          <span className="text-[10px] opacity-80">
            {ticketDuration(offer)}
          </span>
          <span className="flex items-center gap-1" aria-hidden="true">
            <span className="w-3 border-t border-dashed opacity-50" />
            <Plane className="size-4 -rotate-45" />
            <span className="w-3 border-t border-dashed opacity-50" />
          </span>
        </span>
        <span className="min-w-0 text-end">
          <span className="block text-[11px] opacity-75">رسیدن</span>
          <strong
            dir="ltr"
            className="block text-end text-2xl font-black tabular-nums"
          >
            {arrival.time}
          </strong>
          <span className="block truncate text-sm font-bold">
            {destinationLabel}
          </span>
          <span className="mt-1 block text-[11px] opacity-80">
            {arrival.date}
          </span>
        </span>
      </span>
      <span
        className={`flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs ${selected ? 'border-white/20 bg-white/10' : 'border-border bg-muted/40'}`}
      >
        <span>
          {offer.cabinClassCode === 'BUSINESS'
            ? 'بیزینس'
            : offer.cabinClassCode === 'FIRST'
              ? 'فرست'
              : 'اکونومی'}
        </span>
        <span>
          ظرفیت کل: {new Intl.NumberFormat('fa-IR').format(offer.totalCapacity)}{' '}
          نفر
        </span>
      </span>
    </button>
  );
}
