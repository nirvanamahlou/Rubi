import { ticketOfferRoutes } from './ticket-sale-routes';
import type { TicketSaleRouteV1 } from './index';
export interface ReturnWindowOffer {
  saleRoutes?: readonly TicketSaleRouteV1[];
  originId: string;
  destinationId: string;
  departureAt: string | Date;
  arrivalAt: string | Date;
  returnMinDays?: number | null;
  returnMaxDays?: number | null;
}

export function validReturnWindow(min?: number | null, max?: number | null) {
  return (
    [min, max].every(
      (value) =>
        value == null ||
        (Number.isInteger(value) && value >= 0 && value <= 365),
    ) &&
    (min == null || max == null || min <= max)
  );
}

export function ticketCalendarDate(value: string | Date) {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(value));
}

export function ticketReturnBounds(outbound: ReturnWindowOffer) {
  const day = Date.parse(
    ticketCalendarDate(outbound.departureAt) + 'T00:00:00Z',
  );
  // Published schedules use the modern Tehran calendar (UTC+03:30).
  const midnight = (offset: number) =>
    new Date(day + offset * 86_400_000 - 210 * 60_000);
  const start = midnight(outbound.returnMinDays ?? 0);
  const arrival = new Date(outbound.arrivalAt);
  return {
    from: arrival > start ? arrival : start,
    to:
      outbound.returnMaxDays == null
        ? undefined
        : new Date(midnight(outbound.returnMaxDays + 1).getTime() - 1),
  };
}

export function eligibleTicketReturn(
  outbound: ReturnWindowOffer,
  returning: ReturnWindowOffer,
) {
  if (
    !ticketOfferRoutes(outbound).some((a) =>
      ticketOfferRoutes(returning).some(
        (b) => a.originId === b.destinationId && a.destinationId === b.originId,
      ),
    ) ||
    new Date(returning.departureAt) < new Date(outbound.arrivalAt) ||
    new Date(returning.departureAt) <= new Date(outbound.departureAt)
  )
    return false;
  const days =
    (Date.parse(ticketCalendarDate(returning.departureAt)) -
      Date.parse(ticketCalendarDate(outbound.departureAt))) /
    86_400_000;
  return (
    days >= (outbound.returnMinDays ?? 0) &&
    (outbound.returnMaxDays == null || days <= outbound.returnMaxDays)
  );
}
