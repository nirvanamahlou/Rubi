import { moneyDecimal, moneyUnits } from './pricing';
import type { SalesMoney, SalesServiceInput } from './index';

export const PASSENGER_DEDUCTIONS = 'passengerDeductionsV1';
export type PassengerDeductions = Record<
  string,
  {
    discount?: SalesMoney;
    commission?: SalesMoney;
  }
>;

export function readPassengerDeductions(
  services: readonly Pick<SalesServiceInput, 'metadata'>[],
  passengers: readonly { customerId: string }[],
): PassengerDeductions {
  const sources = services.filter(
    (s) => s.metadata?.[PASSENGER_DEDUCTIONS] !== undefined,
  );
  if (!sources.length) return {};
  const fail = () => {
    throw Error('تخفیف و کمیسیون مسافران معتبر نیست.');
  };
  if (sources.length !== 1) return fail();
  const raw = sources[0]!.metadata![PASSENGER_DEDUCTIONS];
  if (typeof raw !== 'string' || raw.length > 100000) return fail();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return fail();
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    return fail();
  const ids = new Set(passengers.map((p) => p.customerId));
  for (const [id, value] of Object.entries(parsed)) {
    if (
      !ids.has(id) ||
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value)
    )
      return fail();
    for (const [kind, price] of Object.entries(value)) {
      if (
        !['discount', 'commission'].includes(kind) ||
        !price ||
        typeof price !== 'object' ||
        Array.isArray(price)
      )
        return fail();
      const row = price as Record<string, unknown>;
      if (
        Object.keys(row).length !== 2 ||
        typeof row.amount !== 'string' ||
        !/^\d+(?:\.\d{1,4})?$/.test(row.amount) ||
        typeof row.currencyCode !== 'string' ||
        !/^[A-Z]{3}$/.test(row.currencyCode)
      )
        return fail();
      moneyUnits(row.amount);
    }
  }
  return parsed as PassengerDeductions;
}

/** Each person's deductions stay within that person's same-currency service prices. */
export function passengerNetPrices(
  prices: Readonly<Record<string, readonly SalesMoney[]>>,
  deductions: PassengerDeductions,
): Record<string, SalesMoney[]> {
  if (Object.keys(deductions).some((id) => !Object.hasOwn(prices, id)))
    throw Error('تخفیف و کمیسیون مسافران معتبر نیست.');
  return Object.fromEntries(
    Object.entries(prices).map(([id, rows]) => {
      const totals = new Map<string, bigint>();
      for (const price of rows) {
        if (!price.amount.trim()) continue;
        totals.set(
          price.currencyCode,
          (totals.get(price.currencyCode) ?? 0n) + moneyUnits(price.amount),
        );
      }
      for (const price of Object.values(deductions[id] ?? {})) {
        const remaining =
          (totals.get(price.currencyCode) ?? 0n) - moneyUnits(price.amount);
        if (!totals.has(price.currencyCode) || remaining < 0n)
          throw Error(
            'تخفیف و کمیسیون نباید از قیمت همان مسافر در همان ارز بیشتر باشد.',
          );
        totals.set(price.currencyCode, remaining);
      }
      return [
        id,
        [...totals].map(([currencyCode, amount]) => ({
          currencyCode,
          amount: moneyDecimal(amount),
        })),
      ];
    }),
  );
}
