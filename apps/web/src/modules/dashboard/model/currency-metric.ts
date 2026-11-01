import { currencySymbol, currencySymbols } from '@/lib/currency-symbol';

export function currencyMetricParts(value: string) {
  const text = value.trim();
  const canonical = /^(.*?)\s+([A-Z]{3})$/.exec(text);
  if (canonical?.[1] !== undefined && canonical[2]) {
    return {
      amount: canonical[1].trim(),
      symbol: currencySymbol(canonical[2]),
    };
  }
  const symbol = [...new Set(Object.values(currencySymbols))]
    .sort((left, right) => right.length - left.length)
    .find((candidate) => text.startsWith(candidate));
  return {
    amount: symbol ? text.slice(symbol.length).trim() : text,
    symbol: symbol ?? '',
  };
}
