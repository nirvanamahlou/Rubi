import {
  moneyDecimal,
  moneyUnits,
  type SalesServicePricingV1,
  type TicketOfferV1,
  type TicketSalePriceTierV1,
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

/** Seat blocks follow the published capacity order; a quote may cross blocks. */
export function seatTierTotal(
  amount: string,
  tiers: readonly TicketSalePriceTierV1[] | undefined,
  consumed: number,
  seats: number,
) {
  if (!tiers?.length) return moneyDecimal(moneyUnits(amount) * BigInt(seats));
  let first = 0;
  let total = 0n;
  for (const tier of tiers) {
    const count = Math.max(
      0,
      Math.min(consumed + seats, first + tier.seatCount) -
        Math.max(consumed, first),
    );
    total += moneyUnits(tier.amount) * BigInt(count);
    first += tier.seatCount;
  }
  if (consumed + seats > first)
    throw new Error('ظرفیت پله‌های قیمت برای این تعداد صندلی کافی نیست.');
  return moneyDecimal(total);
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
  const pair = outbound.roundTripSalePrices?.find(
    (fare) => fare.returnOfferId === returning.id,
  );
  const pairTotal = seatTierTotal(
    pair!.amount,
    pair!.tiers,
    Math.max(
      outbound.totalCapacity - outbound.remainingCapacity,
      returning.totalCapacity - returning.remainingCapacity,
    ),
    seats,
  );
  const pairUnits = moneyUnits(pairTotal);
  const outboundTotal = pair?.tiers?.length
    ? moneyDecimal(pairUnits / 2n)
    : moneyDecimal(moneyUnits(fares.outboundAmount) * BigInt(seats));
  const returnTotal = pair?.tiers?.length
    ? moneyDecimal(pairUnits - pairUnits / 2n)
    : moneyDecimal(moneyUnits(fares.returnAmount) * BigInt(seats));
  const price = (amount: string): SalesServicePricingV1[] => {
    const total = amount;
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
    'flight-outbound': price(outboundTotal),
    'flight-return': price(returnTotal),
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
  const total = seatTierTotal(
    fare.amount,
    fare.tiers,
    offer.totalCapacity - offer.remainingCapacity,
    seats,
  );
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
