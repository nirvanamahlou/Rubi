import type { ReservationManifestTicketCardV1 } from '@nora/contracts';

export interface ManifestTicketRouteFilters {
  originName?: string;
  destinationName?: string;
}

export function filterManifestTickets(
  tickets: readonly ReservationManifestTicketCardV1[],
  filters: ManifestTicketRouteFilters,
): readonly ReservationManifestTicketCardV1[] {
  return tickets.filter(
    (ticket) =>
      (!filters.originName || ticket.originName === filters.originName) &&
      (!filters.destinationName ||
        ticket.destinationName === filters.destinationName),
  );
}
