import type {
  SalesContractAmendmentV1,
  SalesTicketDirection,
} from '@nora/contracts';
import { salesContractOnlyFlights } from '@nora/contracts';
import { salesFlightToday } from '@/modules/sales/model/sales-flight-range';

export function amendmentFlightDay(
  draft: SalesContractAmendmentV1,
  direction: SalesTicketDirection,
) {
  const flight =
    draft.ticketSelections?.find((t) => t.direction === direction) ??
    salesContractOnlyFlights(draft.services).find(
      (t) => t.direction === direction,
    );
  return flight
    ? salesFlightToday(new Date(flight.departureAt))
    : ((direction === 'RETURN'
        ? draft.returnNotBefore
        : draft.departureDate
      )?.slice(0, 10) ?? '');
}

export function matchesSavedAmendmentFlight(
  draft: SalesContractAmendmentV1,
  direction: SalesTicketDirection,
  day: string,
  carrierName?: string,
) {
  const flight = draft.ticketSelections?.find((t) => t.direction === direction);
  return (
    !!flight &&
    flight.originId ===
      (direction === 'OUTBOUND' ? draft.originId : draft.destinationId) &&
    flight.destinationId ===
      (direction === 'OUTBOUND' ? draft.destinationId : draft.originId) &&
    amendmentFlightDay(draft, direction) === day &&
    (!carrierName || flight.carrierNameSnapshot === carrierName)
  );
}
