import type { TicketOfferV1 } from '@nora/contracts';
export const tourTicketDay = (value: string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tehran' }).format(
    new Date(value),
  );
export function tourTicketDates(
  outbound: Pick<TicketOfferV1, 'departureAt' | 'arrivalAt'>,
  returning?: Pick<TicketOfferV1, 'departureAt'>,
) {
  return {
    start: tourTicketDay(outbound.departureAt),
    end: tourTicketDay(returning?.departureAt ?? outbound.arrivalAt),
  };
}
export function activeTourTickets(
  offers: readonly TicketOfferV1[],
  branchId: string,
) {
  return offers.filter(
    (offer) => offer.status === 'ACTIVE' && offer.branchId === branchId,
  );
}

export const tourTicketsForDate = (
  offers: readonly TicketOfferV1[],
  day: string,
) => offers.filter((offer) => !day || tourTicketDay(offer.departureAt) === day);

export const tourTicketDays = (offers: readonly TicketOfferV1[]) =>
  [...new Set(offers.map((offer) => tourTicketDay(offer.departureAt)))].sort();

export function tourDatesAfterOutbound(
  offer: Pick<TicketOfferV1, 'departureAt' | 'arrivalAt'>,
  returnDay: string,
  roundtrip: boolean,
) {
  const dates = tourTicketDates(offer);
  return {
    start: dates.start,
    end: roundtrip ? (returnDay >= dates.start ? returnDay : '') : dates.end,
  };
}

export function changeTourTicketDate(
  current: {
    dates: { start: string; end: string };
    outbound: string;
    returning: string;
  },
  direction: 'out' | 'back',
  day: string,
  roundtrip: boolean,
) {
  if (day === current.dates[direction === 'out' ? 'start' : 'end'])
    return current;
  if (direction === 'back')
    return { ...current, dates: { ...current.dates, end: day }, returning: '' };
  const keepReturn = roundtrip && (!day || current.dates.end >= day);
  return {
    dates: { start: day, end: keepReturn ? current.dates.end : '' },
    outbound: '',
    returning: keepReturn ? current.returning : '',
  };
}
