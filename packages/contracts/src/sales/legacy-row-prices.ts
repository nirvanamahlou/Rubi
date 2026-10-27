import { readLegacyServiceParties } from './legacy-service-parties';
import {
  readPassengerTotalPrices,
  PASSENGER_TOTAL_PRICES,
} from './passenger-total-prices';
import {
  readPassengerDeductions,
  PASSENGER_DEDUCTIONS,
  passengerNetPrices,
  type PassengerDeductions,
} from './passenger-deductions';
import { moneyUnits, moneyDecimal } from './pricing';
import type { SalesServiceInput, SalesMoney } from './index';

export const LEGACY_ROW_PRICES = 'legacyRowPricesV1';
/** Pricing ordinals only. These keys never identify Customers or passenger allocations. */
export function legacyPricingRows(services: readonly SalesServiceInput[]) {
  const parties = readLegacyServiceParties(services);
  if (!parties) return [];
  const largest = Object.values(parties).reduce((a, b) =>
    a.adults + a.children + a.infants >= b.adults + b.children + b.infants
      ? a
      : b,
  );
  return (
    [
      ['ADT', largest.adults],
      ['CHD', largest.children],
      ['INF', largest.infants],
    ] as const
  ).flatMap(([ageCategory, count]) =>
    Array.from({ length: count }, (_, i) => ({
      key: `legacy-${ageCategory}-${i + 1}`,
      ageCategory,
      ordinal: i + 1,
    })),
  );
}
export function readLegacyRowPrices(services: readonly SalesServiceInput[]): {
  gross: Record<string, SalesMoney[]>;
  deductions: PassengerDeductions;
} | null {
  const marked = services.filter(
    (s) => s.metadata?.[LEGACY_ROW_PRICES] !== undefined,
  );
  if (!marked.length) return null;
  const rows = legacyPricingRows(services);
  if (marked.length !== 1 || marked[0] !== services[0] || !rows.length)
    throw Error('قیمت ردیف‌های قرارداد قدیمی معتبر نیست.');
  const raw = marked[0]!.metadata![LEGACY_ROW_PRICES];
  if (typeof raw !== 'string' || raw.length > 200000)
    throw Error('قیمت ردیف‌های قرارداد قدیمی معتبر نیست.');
  const data: unknown = JSON.parse(raw);
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    Object.keys(data).sort().join(',') !== 'deductions,gross'
  )
    throw Error('قیمت ردیف‌های قرارداد قدیمی معتبر نیست.');
  const value = data as Record<string, unknown>;
  const refs = rows.map((r) => ({ customerId: r.key }));
  const metadata = {
    passengerPackagePricingVersion: 1,
    [PASSENGER_TOTAL_PRICES]: JSON.stringify(value.gross),
    [PASSENGER_DEDUCTIONS]: JSON.stringify(value.deductions),
  };
  const gross = readPassengerTotalPrices([{ metadata }], refs)!;
  const deductions = readPassengerDeductions([{ metadata }], refs);
  passengerNetPrices(gross, deductions);
  return { gross, deductions };
}
export function legacyRowPriceTotals(services: readonly SalesServiceInput[]) {
  const prices = readLegacyRowPrices(services);
  if (!prices) return null;
  const sums = new Map<string, bigint>();
  for (const rows of Object.values(
    passengerNetPrices(prices.gross, prices.deductions),
  ))
    for (const p of rows)
      sums.set(
        p.currencyCode,
        (sums.get(p.currencyCode) ?? 0n) + moneyUnits(p.amount),
      );
  return [...sums]
    .filter(([, n]) => n > 0n)
    .map(([currencyCode, n]) => ({ currencyCode, amount: moneyDecimal(n) }));
}
