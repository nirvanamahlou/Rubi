import type { TicketSaleRouteV1 } from './index';
type RoutedOffer = TicketSaleRouteV1 & {
  saleRoutes?: readonly TicketSaleRouteV1[];
};
export function ticketOfferRoutes(
  offer: RoutedOffer,
): readonly TicketSaleRouteV1[] {
  return [
    { originId: offer.originId, destinationId: offer.destinationId },
    ...(offer.saleRoutes ?? []),
  ];
}
export function ticketOfferMatchesRoute(
  offer: RoutedOffer,
  route: TicketSaleRouteV1,
) {
  return ticketOfferRoutes(offer).some(
    (r) =>
      r.originId === route.originId && r.destinationId === route.destinationId,
  );
}
