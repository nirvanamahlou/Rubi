import {
  PASSENGER_TOTAL_PRICES,
  PASSENGER_DEDUCTIONS,
  readPassengerTotalPrices,
  readPassengerDeductions,
  passengerNetPrices,
  insuranceExtraRials,
  moneyUnits,
  moneyDecimal,
  salesChequeComponents,
  type SalesContractAmendmentV1,
  type SalesMoney,
  type PassengerDeductions,
} from '@nora/contracts';
import { passengerSaleTotals } from '@/modules/sales/model/passenger-sale-totals';

export function amendmentPassengerGross(
  draft: SalesContractAmendmentV1,
): Record<string, SalesMoney[]> {
  const saved = readPassengerTotalPrices(draft.services, draft.passengers);
  if (saved) return saved;
  const deductions = readPassengerDeductions(draft.services, draft.passengers);
  return Object.fromEntries(
    draft.passengers.map((p) => {
      const sums = new Map(
        (p.agreedPrices ?? []).map((v) => [
          v.currencyCode,
          moneyUnits(v.amount),
        ]),
      );
      for (const v of Object.values(deductions[p.customerId] ?? {}))
        sums.set(
          v.currencyCode,
          (sums.get(v.currencyCode) ?? 0n) + moneyUnits(v.amount),
        );
      for (const s of draft.services.filter(
        (s) =>
          s.metadata?.insuranceAgeSurcharge === true &&
          s.metadata.passengerId === p.customerId,
      ))
        sums.set(
          'IRR',
          (sums.get('IRR') ?? 0n) -
            moneyUnits(insuranceExtraRials(String(s.metadata!.extraToman))),
        );
      return [
        p.customerId,
        [...sums].map(([currencyCode, n]) => ({
          currencyCode,
          amount: moneyDecimal(n),
        })),
      ];
    }),
  );
}
export function applyAmendmentPassengerPrices(
  draft: SalesContractAmendmentV1,
  gross: Record<string, SalesMoney[]>,
  deductions: PassengerDeductions,
): SalesContractAmendmentV1 {
  const actualDeductions: PassengerDeductions = Object.fromEntries(
    Object.entries(deductions).map(([id, values]) => [
      id,
      Object.fromEntries(
        Object.entries(values).filter(
          ([, price]) => price.amount.trim() && moneyUnits(price.amount) > 0n,
        ),
      ),
    ]),
  );
  const net = passengerNetPrices(gross, actualDeductions);
  for (const p of draft.passengers) {
    if (!gross[p.customerId]?.length)
      throw Error(
        'قیمت کل هر مسافر را وارد کنید؛ برای مسافر رایگان صفر وارد کنید.',
      );
    for (const s of draft.services.filter(
      (s) =>
        s.metadata?.insuranceAgeSurcharge === true &&
        s.metadata.passengerId === p.customerId,
    )) {
      const prices = net[p.customerId]!;
      const extra = moneyUnits(
        insuranceExtraRials(String(s.metadata!.extraToman)),
      );
      const rial = prices.find((v) => v.currencyCode === 'IRR');
      if (rial) rial.amount = moneyDecimal(moneyUnits(rial.amount) + extra);
      else prices.push({ currencyCode: 'IRR', amount: moneyDecimal(extra) });
    }
  }
  const totals = passengerSaleTotals(draft.passengers, net);
  return {
    ...draft,
    services: draft.services.map((s, i) => ({
      ...s,
      metadata: {
        ...Object.fromEntries(
          Object.entries(s.metadata ?? {}).filter(
            ([key]) =>
              ![PASSENGER_TOTAL_PRICES, PASSENGER_DEDUCTIONS].includes(key),
          ),
        ),
        ...(i === 0
          ? {
              [PASSENGER_TOTAL_PRICES]: JSON.stringify(gross),
              [PASSENGER_DEDUCTIONS]: JSON.stringify(actualDeductions),
            }
          : {}),
      },
    })),
    passengers: draft.passengers.map((p) => ({
      ...p,
      agreedPrices: totals.prices[p.customerId]!,
    })),
    priceComponents: salesChequeComponents(
      totals.components,
      draft.paymentTerms,
    ),
  };
}
