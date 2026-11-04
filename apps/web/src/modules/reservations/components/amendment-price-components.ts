import {
  LEGACY_ROW_PRICES,
  PASSENGER_TOTAL_PRICES,
  flightRoomTotals,
  readPassengerFlightPrices,
  insuranceExtraRials,
  moneyUnits,
  servicePriceComponents,
  type SalesContractAmendmentV1,
} from '@nora/contracts';

export function amendmentPriceComponents(input: SalesContractAmendmentV1) {
  if (
    input.services.some(
      (s) =>
        s.metadata?.[PASSENGER_TOTAL_PRICES] !== undefined ||
        s.metadata?.[LEGACY_ROW_PRICES] !== undefined,
    )
  )
    return null;
  if (
    !input.services.some((s) => s.metadata?.automaticFlightRoomTotalV1 === true)
  )
    return servicePriceComponents(input.services, input.hotelSelection);
  return flightRoomTotals(
    {
      ...readPassengerFlightPrices(input.services),
      insuranceExtras: input.services
        .filter((s) => s.metadata?.insuranceAgeSurcharge === true)
        .map((s) => ({
          amount: insuranceExtraRials(String(s.metadata!.extraToman)),
          currencyCode: 'IRR',
        })),
    },
    input.hotelSelection?.rooms ?? [],
  )
    .filter((p) => moneyUnits(p.amount) > 0n)
    .map((p) => ({ ...p, type: 'BASE' as const, title: 'مبلغ کل قرارداد' }));
}
