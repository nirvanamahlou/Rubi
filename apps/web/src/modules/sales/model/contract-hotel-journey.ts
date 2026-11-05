import { HOTEL_JOURNEY_MODES, type HotelJourneyV1 } from '@nora/contracts';

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
const day = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value.split('-').reverse().join('/')
    : value;

export function contractHotelJourneyHtml(
  leg: HotelJourneyV1,
  from: string,
  to: string,
) {
  const flight = leg.mode === 'FLIGHT' ? leg.flight : undefined;
  const airport = (
    value: NonNullable<HotelJourneyV1['airport']> | undefined,
  ) => (value ? `${value.name} (${value.code})` : '—');
  return `<section class="hotel-journey" style="break-inside:avoid;border:1px solid #bfd2e5;border-radius:6px;padding:8px;margin:8px 0">
    <h3>${leg.toHotelId === null ? 'مسیر تا فرودگاه برگشت' : 'جابه‌جایی بین اقامت‌ها'}</h3>
    <p><bdi>${escape(from)}</bdi> ← <bdi>${escape(leg.toHotelId === null ? airport(leg.airport) : to)}</bdi> · <b>${escape(HOTEL_JOURNEY_MODES[leg.mode])}</b></p>
    <table><thead><tr><th>حرکت</th><th>رسیدن</th>${flight ? '<th>ایرلاین / شماره پرواز</th><th>کلاس</th>' : ''}</tr></thead>
    <tbody><tr><td><bdi dir="ltr">${escape(day(leg.departureDate))} · ${escape(leg.departureTime)}</bdi></td><td><bdi dir="ltr">${escape(day(leg.arrivalDate))} · ${escape(leg.arrivalTime)}</bdi></td>${flight ? `<td><bdi>${escape(flight.airline)} · ${escape(flight.number)}</bdi></td><td>${escape({ ECONOMY: 'اکونومی', BUSINESS: 'بیزینس', FIRST: 'فرست کلاس' }[flight.cabinClass])}</td>` : ''}</tr></tbody></table>
    ${flight ? `<p>مسیر پرواز: <bdi>${escape(airport(flight.originAirport))}</bdi> ← <bdi>${escape(airport(flight.destinationAirport))}</bdi></p>` : ''}
    <small>ساعت‌های جابه‌جایی به وقت تهران هستند.</small>
  </section>`;
}
