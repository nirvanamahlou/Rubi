import type { TicketOfferV1 } from '@nora/contracts';
import { salesFlightToday } from './sales-flight-range';

export const flightDay = (offer: TicketOfferV1) =>
  salesFlightToday(new Date(offer.departureAt));
export const exactFlightQuery = (day: string) => ({
  departureFrom: `${day}T00:00:00+03:30`,
  // The search API's upper bound is UTC end-of-day; filter Tehran day in the picker too.
  departureTo: day,
});
export function eligibleReturn(
  outbound: TicketOfferV1,
  returning: TicketOfferV1,
) {
  const days =
    (Date.parse(flightDay(returning)) - Date.parse(flightDay(outbound))) /
    86400000;
  return (
    outbound.branchId === returning.branchId &&
    outbound.originId === returning.destinationId &&
    outbound.destinationId === returning.originId &&
    Date.parse(returning.departureAt) >= Date.parse(outbound.arrivalAt) &&
    days >= (outbound.returnMinDays ?? 0) &&
    days <= (outbound.returnMaxDays ?? Infinity)
  );
}
