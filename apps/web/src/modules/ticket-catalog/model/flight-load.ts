import {
  eligibleTicketReturn,
  ticketCalendarDate,
  type TicketOfferV1,
} from '@nora/contracts';
import type { Reference } from './catalog';

export const countryFlightLoadOffers = (
  offers: readonly TicketOfferV1[],
  references: readonly Reference[],
  country: string,
  originCountry = '',
) => {
  const matches = (cityId: string, countryId: string) =>
    !countryId ||
    references.some(
      (ref) =>
        ref.kind === 'city' && ref.id === cityId && ref.countryId === countryId,
    );
  return offers.filter(
    (offer) =>
      matches(offer.originId, originCountry) &&
      matches(offer.destinationId, country),
  );
};

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
// Unknown legacy provenance stays unknown; do not hide existing tickets or
// silently rewrite their supply. Explicit floating/API offers stay excluded.
export const isCompanyLoadOffer = (offer: TicketOfferV1) =>
  offer.supplyType == null || offer.supplyType === 'COMPANY';

export const currentCompanyLoadOffers = (
  offers: readonly TicketOfferV1[],
  now = new Date(),
) =>
  offers.filter(
    (offer) =>
      isCompanyLoadOffer(offer) &&
      Date.parse(offer.departureAt) >= now.getTime(),
  );

export function validFlightLoadDates(
  offers: readonly TicketOfferV1[],
  filter: FlightLoadFilter,
  now = new Date(),
) {
  const dates = currentCompanyLoadOffers(offers, now)
    .filter(
      (offer) =>
        isCompanyLoadOffer(offer) &&
        (!filter.origin || offer.originId === filter.origin) &&
        (!filter.destination || offer.destinationId === filter.destination),
    )
    .map((offer) => ticketCalendarDate(offer.departureAt))
    .sort();
  return {
    from: ticketCalendarDate(now.toISOString()),
    to: dates.at(-1) ?? '',
  };
}
export const canSearchFlightLoad = (filter: FlightLoadFilter) =>
  Boolean(filter.origin || filter.destination || filter.from || filter.to);

export function changeFlightLoadFilter(
  current: FlightLoadFilter,
  field: keyof FlightLoadFilter,
  value: string,
): FlightLoadFilter {
  const next = { ...current, [field]: value };
  if (next.from && next.to && next.from > next.to) {
    if (field === 'from') next.to = '';
    if (field === 'to') next.from = '';
  }
  return next;
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
        isCompanyLoadOffer(offer) &&
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
        isCompanyLoadOffer(offer) &&
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

export function disjointFlightLoadLegs(
  outbounds: readonly TicketOfferV1[],
  returns: readonly TicketOfferV1[],
) {
  const returnIds = new Set(returns.map((offer) => offer.id));
  return outbounds.filter((offer) => !returnIds.has(offer.id));
}
