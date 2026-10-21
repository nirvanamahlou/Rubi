import { moneyUnits } from './pricing';
import type { SalesMoney, SalesServiceInput } from './index';
import {
  passengerNetPrices,
  readPassengerDeductions,
} from './passenger-deductions';
import { insuranceExtraRials } from './insurance-extra';

export const PASSENGER_TOTAL_PRICES = 'passengerTotalPricesV1';

/** Gross package prices; no flight/hotel allocation is implied. Absence is legacy. */
export function readPassengerTotalPrices(
  services: readonly Pick<SalesServiceInput, 'metadata'>[],
  passengers: readonly { customerId: string }[],
): Record<string, SalesMoney[]> | null {
  const sources = services.filter(
    (s) => s.metadata?.[PASSENGER_TOTAL_PRICES] !== undefined,
  );
  if (!sources.length) return null;
  const fail = (): never => {
    throw Error('قیمت ریالی و ارزی کل خدمات مسافران معتبر نیست.');
  };
  if (
    sources.length !== 1 ||
    services.some((s) => s.metadata?.passengerPackagePricingVersion !== 1)
  )
    return fail();
  const raw = sources[0]!.metadata![PASSENGER_TOTAL_PRICES];
  if (typeof raw !== 'string' || raw.length > 100000) return fail();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return fail();
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return fail();
  const rows = Object.entries(data);
  const ids = new Set(passengers.map((p) => p.customerId));
  if (rows.length !== ids.size) return fail();
  for (const [id, prices] of rows) {
    if (
      !ids.has(id) ||
      !Array.isArray(prices) ||
      prices.length < 1 ||
      prices.length > 2
    )
      return fail();
    const codes = new Set<string>();
    for (const price of prices) {
      if (
        !price ||
        typeof price !== 'object' ||
        Array.isArray(price) ||
        Object.keys(price).length !== 2 ||
        typeof price.currencyCode !== 'string' ||
        !/^[A-Z]{3}$/.test(price.currencyCode) ||
        typeof price.amount !== 'string' ||
        !/^\d+(?:\.\d{1,4})?$/.test(price.amount) ||
        codes.has(price.currencyCode)
      )
        return fail();
      codes.add(price.currencyCode);
      moneyUnits(price.amount);
    }
    if (prices.length === 2 && !codes.has('IRR')) return fail();
  }
  return data as Record<string, SalesMoney[]>;
}

export function validatePassengerTotalPricing(
  services: readonly Pick<SalesServiceInput, 'metadata'>[],
  passengers: readonly {
    customerId: string;
    agreedPrices?: readonly SalesMoney[];
  }[],
) {
  const gross = readPassengerTotalPrices(services, passengers);
  if (!gross) return;
  const net = passengerNetPrices(
    gross,
    readPassengerDeductions(services, passengers),
  );
  const signature = (rows: readonly SalesMoney[]) => {
    const sums = new Map<string, bigint>();
    for (const p of rows)
      sums.set(
        p.currencyCode,
        (sums.get(p.currencyCode) ?? 0n) + moneyUnits(p.amount),
      );
    return JSON.stringify(
      [...sums]
        .filter(([, n]) => n !== 0n)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([code, n]) => [code, n.toString()]),
    );
  };
  for (const p of passengers) {
    const extras = services
      .filter(
        (s) =>
          s.metadata?.insuranceAgeSurcharge === true &&
          s.metadata.passengerId === p.customerId,
      )
      .map((s) => ({
        currencyCode: 'IRR',
        amount: insuranceExtraRials(String(s.metadata!.extraToman)),
      }));
    if (
      signature([...(net[p.customerId] ?? []), ...extras]) !==
      signature(p.agreedPrices ?? [])
    )
      throw Error(
        'مبلغ نهایی هر مسافر باید برابر قیمت ریالی و ارزی پس از تخفیف و کمیسیون باشد.',
      );
  }
}
