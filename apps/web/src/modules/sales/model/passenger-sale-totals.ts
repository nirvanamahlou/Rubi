import {
  moneyDecimal,
  moneyUnits,
  type SalesMoney,
  type SalesPriceComponentInput,
} from '@nora/contracts';

/** Package totals are the sales source; no service-level allocation is inferred. */
export function passengerSaleTotals(
  passengers: readonly { customerId: string }[],
  prices: Record<string, readonly SalesMoney[]>,
) {
  const totals = new Map<string, bigint>();
  for (const passenger of passengers) {
    const rows = prices[passenger.customerId] ?? [];
    if (!rows.length)
      throw new Error(
        'قیمت کل هر مسافر را وارد کنید؛ برای مسافر رایگان صفر وارد کنید.',
      );
    const seen = new Set<string>();
    for (const row of rows) {
      if (!/^[A-Z]{3}$/.test(row.currencyCode) || seen.has(row.currencyCode))
        throw new Error('ارز هر مسافر باید معتبر و یکتا باشد.');
      seen.add(row.currencyCode);
      totals.set(
        row.currencyCode,
        (totals.get(row.currencyCode) ?? 0n) + moneyUnits(row.amount),
      );
    }
  }
  const components: SalesPriceComponentInput[] = [...totals]
    .filter(([, value]) => value > 0n)
    .map(([currencyCode, value]) => ({
      type: 'BASE',
      title: 'جمع قیمت کل مسافران',
      currencyCode,
      amount: moneyDecimal(value),
    }));
  for (const component of components) moneyUnits(component.amount);
  const active = new Set(components.map((row) => row.currencyCode));
  return {
    components,
    prices: Object.fromEntries(
      passengers.map((p) => {
        const rows = (prices[p.customerId] ?? []).filter((row) =>
          active.has(row.currencyCode),
        );
        return [
          p.customerId,
          rows.length || !components.length
            ? rows
            : [{ currencyCode: components[0]!.currencyCode, amount: '0' }],
        ];
      }),
    ),
  };
}
