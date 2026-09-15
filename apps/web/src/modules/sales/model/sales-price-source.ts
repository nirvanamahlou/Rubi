import {
  moneyDecimal,
  moneyUnits,
  type SalesServicePricingV1,
  type PackageTourSalesPriceChoiceV1,
  type TicketOfferV1,
} from '@nora/contracts';
import { salesPassengerCounts, type SalesFormState } from './sales-form';

/** Ticket-only sales use the current list fare; package quotations use Package Pricing. */
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
  const key = `flight-${direction.toLowerCase()}`;
  return {
    ...state.servicePricing,
    [key]: [
      {
        version: 1,
        currencyCode: fare.currencyCode,
        daySale: { basis: 'TOTAL', amount: total },
        agreed: { basis: 'TOTAL', amount: total },
      },
    ],
  };
}

/** Breaks one published package flight sale across directions exactly once. */
export function publishedTourServicePricing(
  state: SalesFormState,
  choice: PackageTourSalesPriceChoiceV1,
): Record<string, SalesServicePricingV1[]> {
  if (!state.tour) throw new Error('نوبت تور انتخاب نشده است.');
  const people = salesPassengerCounts(state);
  const flightUnits =
    moneyUnits(choice.adultFlightSale) * BigInt(people.adults) +
    moneyUnits(choice.childFlightSale) * BigInt(people.children) +
    (state.tour.outbound.cabinClassCode === 'BUSINESS' ||
    state.tour.returning?.cabinClassCode === 'BUSINESS'
      ? moneyUnits(choice.businessUplift) * BigInt(people.adults)
      : 0n);
  const quantum = choice.currencyCode === 'IRR' ? 10000n : 100n;
  const returnUnits = state.tour.returning
    ? (flightUnits / 2n / quantum) * quantum
    : 0n;
  const outboundUnits = flightUnits - returnUnits;
  if (outboundUnits <= 0n || (state.tour.returning && returnUnits <= 0n))
    throw new Error('قیمت منتشرشده پرواز برای تقسیم رفت و برگشت معتبر نیست.');
  const hotelUnits =
    moneyUnits(choice.hotelSale) * BigInt(state.hotel.roomCount);
  if (hotelUnits <= 0n) throw new Error('قیمت منتشرشده هتل معتبر نیست.');
  const price = (units: bigint): SalesServicePricingV1[] => [
    {
      version: 1,
      currencyCode: choice.currencyCode,
      daySale: { basis: 'TOTAL', amount: moneyDecimal(units) },
      agreed: { basis: 'TOTAL', amount: moneyDecimal(units) },
    },
  ];
  return {
    ...state.servicePricing,
    'flight-outbound': price(outboundUnits),
    ...(state.tour.returning ? { 'flight-return': price(returnUnits) } : {}),
    hotel: price(hotelUnits),
  };
}
