import type { TicketOfferCreateV1, TicketOfferV1 } from '@nora/contracts';
import type { Product } from './catalog';
import { publishedLoadGroup, publishedOfferInput } from './published-catalog';

function civilDate(instant: string) {
  return new Intl.DateTimeFormat('en-CA', {
    calendar: 'gregory',
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(instant));
}

export function loadWeekdayOffers(
  selected: TicketOfferV1,
  offers: readonly TicketOfferV1[],
  local: readonly Product[],
) {
  const weekday = (value: string) =>
    new Date(civilDate(value) + 'T00:00:00Z').getUTCDay();
  return publishedLoadGroup(selected, offers, local).filter(
    (offer) =>
      offer.originId === selected.originId &&
      offer.destinationId === selected.destinationId &&
      weekday(offer.departureAt) === weekday(selected.departureAt),
  );
}

/** Apply only edited facts to their existing identities, keeping each dated flight. */
export function loadWeekdayRevisions(
  selected: TicketOfferV1,
  offers: readonly TicketOfferV1[],
  next: TicketOfferCreateV1,
) {
  if (civilDate(next.departureAt) !== civilDate(selected.departureAt))
    throw new Error('تاریخ حرکت در ویرایش روز هفته قابل تغییر نیست.');
  const before = publishedOfferInput(selected);
  const changed = Object.fromEntries(
    Object.entries(next).filter(
      ([key, value]) =>
        key !== 'departureAt' &&
        key !== 'arrivalAt' &&
        JSON.stringify(value) !==
          JSON.stringify(before[key as keyof typeof before]),
    ),
  );
  const departureChanged = next.departureAt !== selected.departureAt;
  const arrivalChanged = next.arrivalAt !== selected.arrivalAt;
  return offers.map((offer) => {
    const dayOffset =
      Date.parse(civilDate(offer.departureAt) + 'T00:00:00Z') -
      Date.parse(civilDate(selected.departureAt) + 'T00:00:00Z');
    return {
      id: offer.id,
      expectedVersion: offer.version,
      offer: {
        ...publishedOfferInput(offer),
        ...changed,
        departureAt: departureChanged
          ? new Date(Date.parse(next.departureAt) + dayOffset).toISOString()
          : offer.departureAt,
        arrivalAt: arrivalChanged
          ? new Date(Date.parse(next.arrivalAt) + dayOffset).toISOString()
          : offer.arrivalAt,
      },
    };
  });
}
