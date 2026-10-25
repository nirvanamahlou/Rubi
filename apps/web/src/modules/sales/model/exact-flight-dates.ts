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

/** Only registered pair identities can suggest a date; ambiguous dates stay manual. */
export function pairedReturnDate(
  outbound: readonly TicketOfferV1[],
  returning: readonly TicketOfferV1[],
  seats: number,
) {
  const pairs = outbound.flatMap((out) => {
    const back = pairedReturnOffer(out, returning, seats);
    return back ? [{ out, back }] : [];
  });
  const days = [...new Set(pairs.map((p) => flightDay(p.back)))];
  return days.length === 1
    ? { day: days[0]!, outboundIds: [...new Set(pairs.map((p) => p.out.id))] }
    : undefined;
}

/** Select only a unique registered partner; never guess between load dates/flights. */
export function pairedReturnOffer(
  outbound: TicketOfferV1,
  returning: readonly TicketOfferV1[],
  seats: number,
  requireFare = false,
): TicketOfferV1 | undefined {
  if (outbound.status !== 'ACTIVE') return undefined;
  const eligible = returning.filter(
    (back) =>
      back.cabinClassCode === outbound.cabinClassCode &&
      eligibleReturn(outbound, back) &&
      (!outbound.scheduledReturnDate ||
        flightDay(back) === outbound.scheduledReturnDate),
  );
  const loadPartners =
    outbound.loadGroupId &&
    (outbound.returnMaxDays != null || outbound.scheduledReturnDate)
      ? eligible.filter((back) => back.loadGroupId === outbound.loadGroupId)
      : [];
  const pricedIds = new Set(
    outbound.roundTripSalePrices?.map((p) => p.returnOfferId),
  );
  // Preserve the original load partner; a price pair can disambiguate recurring
  // dates within that load, but cannot replace it with an unrelated alternative.
  const candidates =
    loadPartners.length === 1
      ? loadPartners
      : loadPartners.length
        ? pricedIds.size
          ? loadPartners.filter((back) => pricedIds.has(back.id))
          : loadPartners
        : eligible.filter((back) => pricedIds.has(back.id));
  const unique = [
    ...new Map(candidates.map((back) => [back.id, back])).values(),
  ];
  const partner = unique.length === 1 ? unique[0] : undefined;
  return partner &&
    partner.status === 'ACTIVE' &&
    partner.remainingCapacity >= seats &&
    (!requireFare || partner.standaloneSalePrice || pricedIds.has(partner.id))
    ? partner
    : undefined;
}
