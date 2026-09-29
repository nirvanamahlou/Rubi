import {
  moneyDecimal,
  moneyUnits,
  type SalesServicePricingV1,
  type TicketOfferV1,
} from '@nora/contracts';
import type { SalesFormState } from './sales-form';

/** Ticket-only contracts use this fare; tours keep their package pricing. */
export function standaloneTicketPricing(
  state: SalesFormState,
  offer: TicketOfferV1,
  direction: 'OUTBOUND' | 'RETURN',
  seats: number,
): Record<string, SalesServicePricingV1[]> {
  if (
    state.tour ||
    state.serviceKinds.includes('HOTEL') ||
    state.serviceKinds.includes('TOUR') ||
    !offer.standaloneSalePrice
  )
    return state.servicePricing ?? {};
  const fare = offer.standaloneSalePrice;
  const total = moneyDecimal(moneyUnits(fare.amount) * BigInt(seats));
  return {
    ...state.servicePricing,
    [`flight-${direction.toLowerCase()}`]: [
      {
        version: 1,
        currencyCode: fare.currencyCode,
        daySale: { basis: 'TOTAL', amount: total },
        agreed: { basis: 'TOTAL', amount: total },
      },
    ],
  };
}

export function repriceStandaloneTicketSelections(
  state: SalesFormState,
  seats: number,
): Record<string, SalesServicePricingV1[]> {
  let servicePricing = state.servicePricing ?? {};
  if (state.outboundOffer)
    servicePricing = standaloneTicketPricing(
      { ...state, servicePricing },
      state.outboundOffer,
      'OUTBOUND',
      seats,
    );
  if (state.returnOffer)
    servicePricing = standaloneTicketPricing(
      { ...state, servicePricing },
      state.returnOffer,
      'RETURN',
      seats,
    );
  return servicePricing;
}
