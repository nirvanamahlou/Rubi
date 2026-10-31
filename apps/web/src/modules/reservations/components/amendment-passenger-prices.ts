import {
  LEGACY_ROW_PRICES,
  legacyPricingRows,
  readLegacyRowPrices,
  SALES_CHEQUE_FEE,
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
  const legacy = readLegacyRowPrices(draft.services);
  if (legacy) return legacy.gross;
  const saved = readPassengerTotalPrices(draft.services, draft.passengers);
  if (saved) return saved;
  const rows = amendmentPricingRows(draft);
  if (!rows.some((p) => p.agreedPrices?.length)) {
    const sums = new Map<string, bigint>();
    for (const p of draft.priceComponents.filter(
      (p) => p.title !== SALES_CHEQUE_FEE,
    ))
      sums.set(
        p.currencyCode,
        (sums.get(p.currencyCode) ?? 0n) +
          (p.type === 'DISCOUNT' ? -1n : 1n) * moneyUnits(p.amount),
      );
    for (const values of Object.values(amendmentPricingDeductions(draft)))
      for (const price of Object.values(values))
        sums.set(
          price.currencyCode,
          (sums.get(price.currencyCode) ?? 0n) + moneyUnits(price.amount),
        );
    for (const extra of draft.services.filter(
      (s) => s.metadata?.insuranceAgeSurcharge === true,
    ))
      sums.set(
        'IRR',
        (sums.get('IRR') ?? 0n) -
          moneyUnits(insuranceExtraRials(String(extra.metadata!.extraToman))),
      );
    const totals = [...sums].map(([currencyCode, n]) => ({
      currencyCode,
      amount: moneyDecimal(n),
    }));
    return Object.fromEntries(
      rows.map((p, i) => [
        p.customerId,
        totals.map((v) => ({ ...v, amount: i === 0 ? v.amount : '0' })),
      ]),
    );
  }

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
  const rows = amendmentPricingRows(draft);
  const anonymous = !draft.passengers.length;
  if (!rows.length) throw Error('تعداد مسافران قرارداد مشخص نیست.');
  for (const p of rows) {
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
  const totals = passengerSaleTotals(rows, net);
  return {
    ...draft,
    services: draft.services.map((s, i) => ({
      ...(Object.fromEntries(
        Object.entries(s).filter(
          ([key]) =>
            key !== 'pricing' || s.metadata?.insuranceAgeSurcharge === true,
        ),
      ) as typeof s),
      metadata: {
        ...Object.fromEntries(
          Object.entries(s.metadata ?? {}).filter(
            ([key]) =>
              ![
                PASSENGER_TOTAL_PRICES,
                PASSENGER_DEDUCTIONS,
                LEGACY_ROW_PRICES,
                'passengerPackagePricingVersion',
                'contractPackagePricingVersion',
                'automaticFlightRoomTotalV1',
                'passengerFlightPricesV1',
                'passengerHotelPricesV1',
              ].includes(key),
          ),
        ),
        ...(anonymous
          ? { contractPackagePricingVersion: 1 }
          : { passengerPackagePricingVersion: 1 }),
        ...(i === 0
          ? anonymous
            ? {
                [LEGACY_ROW_PRICES]: JSON.stringify({
                  gross,
                  deductions: actualDeductions,
                }),
              }
            : {
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

export function amendmentPricingRows(draft: SalesContractAmendmentV1) {
  if (draft.passengers.length)
    return draft.passengers.map((p) => ({
      ...p,
      ageCategory: draft.passengerCategories?.[p.customerId],
    }));
  return legacyPricingRows(draft.services).map((r) => ({
    customerId: r.key,
    displayNameSnapshot: `${r.ageCategory === 'ADT' ? 'بزرگسال' : r.ageCategory === 'CHD' ? 'کودک' : 'نوزاد'} ${r.ordinal}`,
    ageCategory: r.ageCategory,
    agreedPrices: undefined as readonly SalesMoney[] | undefined,
  }));
}
export function amendmentPricingDeductions(
  draft: SalesContractAmendmentV1,
): PassengerDeductions {
  const saved =
    readLegacyRowPrices(draft.services)?.deductions ??
    readPassengerDeductions(draft.services, draft.passengers);
  if (Object.keys(saved).length) return saved;
  const first = amendmentPricingRows(draft)[0];
  if (!first) return {};
  const values: PassengerDeductions[string] = {};
  for (const p of draft.priceComponents) {
    const kind =
      p.type === 'DISCOUNT' && p.title === 'تخفیف قرارداد'
        ? 'discount'
        : p.type === 'DISCOUNT' && p.title === 'کمیسیون قرارداد'
          ? 'commission'
          : null;
    if (!kind) continue;
    const old = values[kind];
    if (old && old.currencyCode !== p.currencyCode)
      throw Error('ارز هر مسافر باید معتبر و یکتا باشد.');
    values[kind] = {
      currencyCode: p.currencyCode,
      amount: moneyDecimal(
        moneyUnits(old?.amount ?? '0') + moneyUnits(p.amount),
      ),
    };
  }
  return Object.keys(values).length ? { [first.customerId]: values } : {};
}
export function prepareAmendmentPersonPrices(draft: SalesContractAmendmentV1) {
  return applyAmendmentPassengerPrices(
    draft,
    amendmentPassengerGross(draft),
    amendmentPricingDeductions(draft),
  );
}
