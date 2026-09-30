import type { ReservationManifestTicketCardV1 } from '@nora/contracts';

export interface ManifestTicketRouteFilters {
  originName?: string;
  destinationName?: string;
}

export function filterManifestTickets(
  tickets: readonly ReservationManifestTicketCardV1[],
  filters: ManifestTicketRouteFilters,
): readonly ReservationManifestTicketCardV1[] {
  const matches = (value: string, search?: string) =>
    !search ||
    value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  return tickets.filter(
    (ticket) =>
      (matches(ticket.originName, filters.originName) &&
        matches(ticket.destinationName, filters.destinationName)) ||
      (ticket.direction === 'RETURN' &&
        matches(ticket.destinationName, filters.originName) &&
        matches(ticket.originName, filters.destinationName)),
  );
}
