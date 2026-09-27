import {
  moneyDecimal,
  moneyUnits,
  type SalesServicePricingV1,
  type TicketOfferV1,
} from '@nora/contracts';
import type { SalesFormState } from './sales-form';

export function roundTripPerLegFares(
  outbound: TicketOfferV1,
  returning: TicketOfferV1,
) {
  const fare = outbound.roundTripSalePrices?.find(
    (item) => item.returnOfferId === returning.id,
  );
  if (!fare) return undefined;
  const units = moneyUnits(fare.amount);
  const outboundUnits = units / 2n;
  return {
    currencyCode: fare.currencyCode,
    outboundAmount: moneyDecimal(outboundUnits),
    returnAmount: moneyDecimal(units - outboundUnits),
  };
}

export function roundTripTicketPricing(
  state: SalesFormState,
  outbound: TicketOfferV1,
  returning: TicketOfferV1,
  seats: number,
): Record<string, SalesServicePricingV1[]> {
  const fares = roundTripPerLegFares(outbound, returning);
  if (!fares) {
    const next = { ...(state.servicePricing ?? {}) };
    delete next['flight-outbound'];
    delete next['flight-return'];
    return next;
  }
  const price = (amount: string): SalesServicePricingV1[] => {
    const total = moneyDecimal(moneyUnits(amount) * BigInt(seats));
    return [
      {
        version: 1,
        currencyCode: fares.currencyCode,
        daySale: { basis: 'TOTAL', amount: total },
        agreed: { basis: 'TOTAL', amount: total },
      },
    ];
  };
  return {
    ...(state.servicePricing ?? {}),
    'flight-outbound': price(fares.outboundAmount),
    'flight-return': price(fares.returnAmount),
  };
}

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
  if (state.outboundOffer && state.returnOffer)
    return roundTripTicketPricing(
      state,
      state.outboundOffer,
      state.returnOffer,
      seats,
    );
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
