import type { TicketOfferV1 } from '@nora/contracts';

export function roundTripPricesByOutbound(offers: readonly TicketOfferV1[]) {
  const offerById = new Map(offers.map((offer) => [offer.id, offer]));
  return new Map(
    offers.flatMap((outbound) => {
      const prices = outbound.roundTripSalePrices ?? [];
      if (!prices.length) return [];
      return [
        [
          outbound.id,
          prices.map((price) => ({
            price,
            returning: offerById.get(price.returnOfferId),
          })),
        ] as const,
      ];
    }),
  );
}
