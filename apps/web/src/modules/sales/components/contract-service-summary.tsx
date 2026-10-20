'use client';
import { useDisplayLanguage } from '@/i18n/locale-context';
import type { SalesFormState } from '../model/sales-form';
import {
  salesDirections,
  salesFlightSelection,
  salesHotelGuestIds,
  salesInternationalTravel,
} from '../model/sales-form';

const labels: Record<string, string> = {
  FLIGHT: 'پرواز',
  HOTEL: 'هتل',
  TRANSFER: 'ترانسفر',
  INSURANCE: 'بیمه',
  VISA: 'ویزا',
  TOUR: 'تور',
  TRAIN: 'قطار',
  BUS: 'اتوبوس',
  CIP: 'CIP',
  OTHER: 'سایر خدمات',
};
export function ContractServiceSummary({
  state,
  origin,
  destination,
  roomType,
}: {
  state: SalesFormState;
  origin?: string | undefined;
  destination?: string | undefined;
  roomType?: string | undefined;
}) {
  const language = useDisplayLanguage();
  const international = salesInternationalTravel(state);
  const nights =
    (Date.parse(state.hotel.checkOut) - Date.parse(state.hotel.checkIn)) /
    86400000;
  const date = (value: string | undefined, time = false) => {
    if (!value) return '—';
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime())
      ? new Intl.DateTimeFormat(
          language === 'en' || international ? 'en-GB' : 'fa-IR',
          {
            ...(international ? { calendar: 'gregory' } : {}),
            timeZone: 'Asia/Tehran',
            dateStyle: 'medium',
            ...(time ? { timeStyle: 'short' as const } : {}),
          },
        ).format(parsed)
      : value;
  };
  return (
    <section
      className="space-y-3 rounded-xl border bg-primary/5 p-4"
      aria-label="خلاصه خدمات قرارداد"
    >
      <h3 className="font-bold">خلاصه خدمات قرارداد</h3>
      <p>
        {state.customerName} · {state.passengers.length} مسافر · {origin || '—'}{' '}
        ← {destination || '—'}
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {state.serviceKinds.map((kind) => (
          <div key={kind} className="rounded-lg bg-surface p-3">
            <dt className="font-semibold">{labels[kind] ?? kind}</dt>
            <dd className="break-words text-sm">
              {kind === 'FLIGHT' ? (
                salesDirections(state, 'FLIGHT').map((direction) => {
                  const flight = salesFlightSelection(state, direction);
                  const offer =
                    direction === 'OUTBOUND'
                      ? state.outboundOffer
                      : state.returnOffer;
                  return (
                    <p key={direction}>
                      {direction === 'OUTBOUND' ? 'رفت' : 'برگشت'}:{' '}
                      {flight?.carrierNameSnapshot || state.ticket.carrier} ·{' '}
                      {flight?.serviceNumberSnapshot ||
                        (direction === 'OUTBOUND'
                          ? state.ticket.outboundNumber
                          : state.ticket.returnNumber)}{' '}
                      ·{' '}
                      {date(
                        flight?.departureAt ||
                          (direction === 'OUTBOUND'
                            ? state.ticket.outboundDepartureAt
                            : state.ticket.returnDepartureAt),
                        true,
                      )}{' '}
                      ·{' '}
                      {offer?.cabinClassCode ||
                        flight?.cabinClassCode ||
                        state.ticket.cabinClassCode}
                    </p>
                  );
                })
              ) : kind === 'HOTEL' ? (
                <>
                  {state.hotel.name} · {date(state.hotel.checkIn)} تا{' '}
                  {date(state.hotel.checkOut)} · {state.hotel.roomCount} اتاق ·{' '}
                  {Number.isInteger(nights) && nights > 0 ? (
                    <>{nights} شب · </>
                  ) : null}
                  {salesHotelGuestIds(state).length} مهمان · {roomType} ·{' '}
                  {state.hotel.singleRoomCount} سینگل /{' '}
                  {state.hotel.doubleRoomCount} دبل /{' '}
                  {state.hotel.extraBedCount} تخت اضافه
                </>
              ) : kind === 'TRANSFER' ? (
                salesDirections(state, 'TRANSFER').map((direction) => {
                  const detail =
                    state.serviceDetails?.[`TRANSFER-${direction}`];
                  return (
                    <p key={direction}>
                      {direction === 'OUTBOUND' ? 'رفت' : 'برگشت'} ·{' '}
                      {date(detail?.date)} · {detail?.pickup} ←{' '}
                      {detail?.dropoff}
                    </p>
                  );
                })
              ) : kind === 'INSURANCE' ? (
                `${state.insurancePlan?.name ?? 'بیمه'} · ${state.insurancePlan?.insurerName ?? ''}`
              ) : kind === 'TOUR' ? (
                `${state.tour?.package.name ?? 'تور انتخاب‌شده'} · ${date(state.tour?.startsOn)} تا ${date(state.tour?.endsOn)}`
              ) : (
                <>
                  {state.serviceDetails?.[kind]?.date
                    ? date(state.serviceDetails[kind]!.date)
                    : 'انتخاب‌شده در قرارداد'}{' '}
                  · {state.serviceDetails?.[kind]?.notes}
                </>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
