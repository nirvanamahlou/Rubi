import type {
  PartnerPaymentV1,
  PartnerPurchaseSourceV1,
} from '@nora/contracts';
import { DecimalValue } from './finance.money';

export function partnerFinanceTotals(
  purchases: readonly PartnerPurchaseSourceV1[],
  payments: readonly PartnerPaymentV1[],
) {
  const groups = new Map<
    string,
    { purchases: DecimalValue; paid: DecimalValue }
  >();
  const group = (code: string) => {
    if (!/^[A-Z]{3}$/.test(code)) throw new Error('ارز منبع مالی معتبر نیست.');
    let row = groups.get(code);
    if (!row) {
      row = {
        purchases: DecimalValue.parse('0'),
        paid: DecimalValue.parse('0'),
      };
      groups.set(code, row);
    }
    return row;
  };
  const sources = new Map(purchases.map((row) => [row.id, row]));
  if (sources.size !== purchases.length)
    throw new Error('منبع خرید تکراری است.');
  for (const source of purchases) {
    const value = DecimalValue.parse(source.amount);
    if (value.compare(DecimalValue.parse('0')) < 0)
      throw new Error('مبلغ خرید منفی است.');
    if (source.current)
      group(source.currencyCode).purchases = group(
        source.currencyCode,
      ).purchases.add(value);
  }
  const seen = new Set<string>();
  for (const payment of payments) {
    if (seen.has(payment.id)) throw new Error('سند پرداخت تکراری است.');
    seen.add(payment.id);
    const source = sources.get(payment.purchaseId);
    if (!source || source.currencyCode !== payment.currencyCode)
      throw new Error('پرداخت با خرید مرتبط سازگار نیست.');
    const value = DecimalValue.parse(payment.amount);
    if (value.compare(DecimalValue.parse('0')) < 0)
      throw new Error('پرداخت منفی معتبر نیست.');
    const row = group(payment.currencyCode);
    row.paid = row.paid.add(value);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currencyCode, row]) => ({
      currencyCode,
      purchases: row.purchases.toString(),
      paid: row.paid.toString(),
      balance: row.purchases.subtract(row.paid).toString(),
    }));
}
