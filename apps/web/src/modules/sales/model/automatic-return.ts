import type { TicketOfferV1 } from '@nora/contracts';
import { pairedReturnOffer, flightDay } from './exact-flight-dates';
import {
  salesDirections,
  salesFlightSeats,
  withSalesHotelDates,
  type SalesFormState,
} from './sales-form';
import { roundTripTicketPricing } from './standalone-ticket-pricing';

/** Apply a late calendar response only while the current return is still empty. */
export function withAutomaticReturn(
  current: SalesFormState,
  route: string,
  offers: readonly TicketOfferV1[],
): SalesFormState {
  if (
    current.originId + ':' + current.destinationId !== route ||
    !current.outboundOffer ||
    current.returnOffer ||
    current.ticket.returnOfferId ||
    current.contractFlights?.RETURN ||
    !salesDirections(current, 'FLIGHT').includes('RETURN')
  )
    return current;
  const paired = pairedReturnOffer(
    current.outboundOffer,
    offers,
    salesFlightSeats(current, 'RETURN'),
  );
  if (!paired) return current;
  return withSalesHotelDates(current, {
    ...current,
    returnDate: flightDay(paired),
    returnOffer: paired,
    servicePricing: roundTripTicketPricing(
      current,
      current.outboundOffer,
      paired,
      salesFlightSeats(current, 'RETURN'),
    ),
    ticket: {
      ...current.ticket,
      returnOfferId: paired.id,
      returnDepartureAt: paired.departureAt,
      returnArrivalAt: paired.arrivalAt,
      returnNumber: paired.serviceNumber,
    },
  });
}
