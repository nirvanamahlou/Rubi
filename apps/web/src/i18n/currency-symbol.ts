/** Display only: canonical ISO codes remain the API/storage/search values. */
export const currencySymbols: Readonly<Record<string, string>> = {
  IRR: '﷼',
  IRI: '﷼',
  USD: '$',
  EUR: '€',
  GBP: '£',
  TRY: '₺',
  AED: '\u062f.\u0625',
  CAD: 'CA$',
  AUD: 'A$',
  CHF: 'Fr',
  CNY: '¥',
  JPY: 'JP¥',
  RUB: '₽',
  SAR: '\u0631.\u0633',
  QAR: '\u0631.\u0642',
  KWD: '\u062f.\u0643',
  OMR: '\u0631.\u0639',
  BHD: '\u062f.\u0628',
  INR: '₹',
  KRW: '₩',
  THB: '฿',
  AZN: '₼',
  GEL: '₾',
  IQD: '\u0639.\u062f',
};
export function currencySymbol(code: string | null | undefined) {
  return code ? (currencySymbols[code] ?? code) : '';
}

const symbolValues = new Set(Object.values(currencySymbols));
export function isCurrencySymbol(value: string) {
  return symbolValues.has(value);
}
