import {
  moneyDecimal,
  moneyUnits,
  type SalesServicePricingV1,
} from '@nora/contracts';
export const roundTripPriceKey = 'flight-round-trip';
type Prices = Record<string, SalesServicePricingV1[]>;
export function combinedFlightPrices(values: Prices): SalesServicePricingV1[] {
  const rows = [
    ...(values['flight-outbound'] ?? []),
    ...(values['flight-return'] ?? []),
  ];
  const currencies = [...new Set(rows.map((row) => row.currencyCode))];
  return currencies.map((currencyCode) => {
    const entries = rows.filter((row) => row.currencyCode === currencyCode);
    const total = (field: 'daySale' | 'agreed') => {
      const incomplete = entries.find(
        (row) =>
          row[field].amount &&
          !/^\d{1,18}(\.\d{1,4})?$/.test(row[field].amount),
      );
      if (incomplete) return incomplete[field].amount;
      if (entries.some((row) => !row[field].amount)) return '';
      return moneyDecimal(
        entries.reduce((sum, row) => sum + moneyUnits(row[field].amount), 0n),
      );
    };
    return {
      version: 1,
      currencyCode,
      daySale: { basis: 'TOTAL', amount: total('daySale') },
      agreed: { basis: 'TOTAL', amount: total('agreed') },
    };
  });
}
/** Keep both service records while preserving the exact displayed sum in every currency. */
export function splitFlightPrices(
  prices: SalesServicePricingV1[],
  previous: Prices,
): Prices {
  const outbound: SalesServicePricingV1[] = [],
    returning: SalesServicePricingV1[] = [];
  for (const price of prices) {
    const first = {
      ...price,
      daySale: { ...price.daySale },
      agreed: { ...price.agreed },
    };
    const second = {
      ...price,
      daySale: { ...price.daySale },
      agreed: { ...price.agreed },
    };
    for (const field of ['daySale', 'agreed'] as const) {
      const oldOut = previous['flight-outbound']?.find(
        (row) => row.currencyCode === price.currencyCode,
      )?.[field].amount;
      const oldReturn = previous['flight-return']?.find(
        (row) => row.currencyCode === price.currencyCode,
      )?.[field].amount;
      if (!price[field].amount) {
        first[field].amount = '';
        second[field].amount = '';
        continue;
      }
      if (!/^\d{1,18}(\.\d{1,4})?$/.test(price[field].amount)) {
        first[field] = { ...price[field] };
        second[field] = { basis: 'TOTAL', amount: '0' };
        continue;
      }
      const total = moneyUnits(price[field].amount);
      // Published day fares may divide odd units per seat; retain their exact leg snapshots.
      const preserve =
        oldOut &&
        oldReturn &&
        /^\d{1,18}(\.\d{1,4})?$/.test(oldOut) &&
        /^\d{1,18}(\.\d{1,4})?$/.test(oldReturn) &&
        moneyUnits(oldOut) + moneyUnits(oldReturn) === total;
      first[field] = {
        basis: 'TOTAL',
        amount: preserve ? oldOut : moneyDecimal(total / 2n),
      };
      second[field] = {
        basis: 'TOTAL',
        amount: preserve ? oldReturn : moneyDecimal(total - total / 2n),
      };
    }
    outbound.push(first);
    returning.push(second);
  }
  return {
    ...previous,
    'flight-outbound': outbound,
    'flight-return': returning,
  };
}
export function tripPricingView(
  services: readonly { key: string; title: string; hotel: boolean }[],
  values: Prices,
) {
  const combined =
    services.some((s) => s.key === 'flight-outbound') &&
    services.some((s) => s.key === 'flight-return');
  const combinedPrices = combinedFlightPrices(values);
  return {
    services: combined
      ? services
          .filter((s) => s.key !== 'flight-return')
          .map((s) =>
            s.key === 'flight-outbound'
              ? { ...s, key: roundTripPriceKey, title: 'بلیط رفت‌وبرگشت' }
              : s,
          )
      : services,
    values:
      combined && combinedPrices.length > 0
        ? { ...values, [roundTripPriceKey]: combinedPrices }
        : values,
    combined,
  };
}
