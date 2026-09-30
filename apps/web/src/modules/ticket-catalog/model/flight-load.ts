import {
  eligibleTicketReturn,
  ticketCalendarDate,
  type TicketOfferV1,
} from '@nora/contracts';
export interface FlightLoadFilter {
  from: string;
  to: string;
  origin: string;
  destination: string;
  carrier: string;
  number: string;
  weekday: string;
  cabin: string;
}
export function companyFlightLegs(
  offers: readonly TicketOfferV1[],
  filter: FlightLoadFilter,
) {
  return offers
    .filter((offer) => {
      const date = ticketCalendarDate(offer.departureAt);
      const weekday = new Date(date + 'T00:00:00Z').getUTCDay().toString();
      return (
        offer.supplyType === 'COMPANY' &&
        (!filter.from || date >= filter.from) &&
        (!filter.to || date <= filter.to) &&
        (!filter.origin || offer.originId === filter.origin) &&
        (!filter.destination || offer.destinationId === filter.destination) &&
        (!filter.carrier || offer.carrierName === filter.carrier) &&
        (!filter.cabin || offer.cabinClassCode === filter.cabin) &&
        (!filter.weekday || weekday === filter.weekday) &&
        (!filter.number ||
          offer.serviceNumber
            .toLocaleLowerCase()
            .includes(filter.number.trim().toLocaleLowerCase()))
      );
    })
    .sort(
      (a, b) =>
        a.departureAt.localeCompare(b.departureAt) ||
        a.serviceNumber.localeCompare(b.serviceNumber) ||
        a.id.localeCompare(b.id),
    );
}
export function companyReturnLegs(
  offers: readonly TicketOfferV1[],
  outbound: TicketOfferV1 | undefined,
  sameClass: boolean,
  carrier = '',
) {
  if (!outbound) return [];
  return offers
    .filter(
      (offer) =>
        offer.id !== outbound.id &&
        offer.supplyType === 'COMPANY' &&
        offer.branchId === outbound.branchId &&
        eligibleTicketReturn(outbound, offer) &&
        (!sameClass || offer.cabinClassCode === outbound.cabinClassCode) &&
        (!carrier || offer.carrierName === carrier),
    )
    .sort(
      (a, b) =>
        a.departureAt.localeCompare(b.departureAt) || a.id.localeCompare(b.id),
    );
}
export function flightLoadTotals(offers: readonly TicketOfferV1[]) {
  return offers.reduce(
    (sum, offer) => ({
      total: sum.total + offer.totalCapacity,
      remaining: sum.remaining + offer.remainingCapacity,
      sold: sum.sold + (offer.allocatedCapacity ?? 0),
      reserved: sum.reserved + (offer.reservedCapacity ?? 0),
    }),
    { total: 0, remaining: 0, sold: 0, reserved: 0 },
  );
}
