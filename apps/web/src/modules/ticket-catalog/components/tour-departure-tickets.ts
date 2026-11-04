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
