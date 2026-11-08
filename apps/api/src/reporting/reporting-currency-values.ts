/** Display components, not an arithmetic sum of unlike currencies. */
export function currencyValues(values: ReadonlyMap<string, string>): string {
  const order = ['IRR', 'EUR', 'USD'];
  return [...values]
    .sort(
      ([a], [b]) =>
        (order.indexOf(a) < 0 ? 3 : order.indexOf(a)) -
          (order.indexOf(b) < 0 ? 3 : order.indexOf(b)) || a.localeCompare(b),
    )
    .map(
      ([code, value]) =>
        `${value} ${{ IRR: 'ریال', USD: '$', EUR: '€' }[code] ?? code}`,
    )
    .join(' + ');
}
