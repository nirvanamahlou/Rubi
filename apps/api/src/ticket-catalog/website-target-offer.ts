import type { TicketOfferV1 } from '@nora/contracts';
/** Public target fares require an explicit saved commission; direct discounts never leak into this projection. */
export function websiteTargetOffer(
  offer: TicketOfferV1,
  targetId: string,
): TicketOfferV1 {
  const rates = (offer.saleCommissions ?? []).filter(
    (c) => c.salePriceTargetId === targetId && !c.isHidden,
  );
  const oneWay = rates.find((c) => !c.returnOfferId);
  return {
    ...offer,
    standaloneSalePrice:
      oneWay && offer.baseStandaloneSalePrice
        ? {
            ...offer.baseStandaloneSalePrice,
            revision: oneWay.revision,
            amount: oneWay.amount,
            childAmount: oneWay.childAmount,
            infantAmount: oneWay.infantAmount,
            currencyCode: oneWay.currencyCode,
            tiers: oneWay.tiers,
          }
        : null,
    roundTripSalePrices: (offer.baseRoundTripSalePrices ?? []).flatMap(
      (price) => {
        const rate = rates.find((c) => c.returnOfferId === price.returnOfferId);
        return rate
          ? [
              {
                ...price,
                amount: rate.amount,
                childAmount: rate.childAmount,
                infantAmount: rate.infantAmount,
                currencyCode: rate.currencyCode,
                tiers: rate.tiers,
              },
            ]
          : [];
      },
    ),
  };
}
