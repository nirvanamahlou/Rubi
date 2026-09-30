import type {
  ReservationManifestTicketCardV1,
  ReservationManifestRouteV1,
} from '@nora/contracts';
export interface ManifestTicketRouteFilters {
  originName?: string;
  destinationName?: string;
  originId?: string;
  destinationId?: string;
  originCountryId?: string;
  destinationCountryId?: string;
}
function routeMatches(
  ticket: ReservationManifestRouteV1,
  filters: ManifestTicketRouteFilters,
  reverse = false,
) {
  const origin = reverse ? 'destination' : 'origin';
  const destination = reverse ? 'origin' : 'destination';
  const matches = (value: string, search?: string) =>
    !search ||
    value.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  return (
    (!filters.originId || ticket[`${origin}Id`] === filters.originId) &&
    (!filters.destinationId ||
      ticket[`${destination}Id`] === filters.destinationId) &&
    (!filters.originCountryId ||
      ticket[`${origin}CountryId`] === filters.originCountryId) &&
    (!filters.destinationCountryId ||
      ticket[`${destination}CountryId`] === filters.destinationCountryId) &&
    matches(ticket[`${origin}Name`], filters.originName) &&
    matches(ticket[`${destination}Name`], filters.destinationName)
  );
}
export function filterManifestTickets(
  tickets: readonly ReservationManifestTicketCardV1[],
  filters: ManifestTicketRouteFilters,
) {
  return tickets.filter(
    (ticket) =>
      routeMatches(ticket, filters) || routeMatches(ticket, filters, true),
  );
}
/** Display direction follows the chosen route; stored contract direction is never mutated. */
export function manifestDisplayDirection(
  ticket: ReservationManifestTicketCardV1,
  filters: ManifestTicketRouteFilters,
) {
  const direct = routeMatches(ticket, filters);
  const reverse = routeMatches(ticket, filters, true);
  return direct === reverse ? ticket.direction : direct ? 'OUTBOUND' : 'RETURN';
}
export function manifestRouteChoices(
  routes: readonly ReservationManifestRouteV1[],
  filters: ManifestTicketRouteFilters,
) {
  const endpoints = routes.flatMap((route) => [
    {
      id: route.originId || '',
      key: route.originId || 'name:' + route.originName,
      name: route.originCityName || route.originName,
      countryId: route.originCountryId || '',
      countryName: route.originCountryName || '',
    },
    {
      id: route.destinationId || '',
      key: route.destinationId || 'name:' + route.destinationName,
      name: route.destinationCityName || route.destinationName,
      countryId: route.destinationCountryId || '',
      countryName: route.destinationCountryName || '',
    },
  ]);
  const cities = [
    ...new Map(endpoints.map((city) => [city.key, city])).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  const countries = [
    ...new Map(
      cities
        .filter((c) => c.countryId && c.countryName)
        .map((c) => [c.countryId, { id: c.countryId, name: c.countryName }]),
    ).values(),
  ].sort((a, b) => a.name.localeCompare(b.name, 'fa'));
  return {
    countries,
    cities,
    origins: cities.filter(
      (c) =>
        !filters.originCountryId || c.countryId === filters.originCountryId,
    ),
    destinations: cities.filter(
      (c) =>
        !filters.destinationCountryId ||
        c.countryId === filters.destinationCountryId,
    ),
  };
}
