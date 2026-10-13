import type { TicketPurchaseInboxItemV1 } from '@nora/contracts';
export const purchaseStages = {
  UNPRICED: 'در انتظار قیمت خرید',
  READY_FOR_PAYMENT: 'ارسال‌شده به مالی',
  PAYING: 'در حال پرداخت',
  PAID: 'تسویه‌شده',
};
export function purchaseSummary(items: readonly TicketPurchaseInboxItemV1[]) {
  const sums = new Map<
    string,
    { invoice: bigint; paid: bigint; remaining: bigint }
  >();
  const units = (s: string) => {
    const [w, f = ''] = s.split('.');
    return BigInt(w!) * 10000n + BigInt(f.padEnd(4, '0'));
  };
  const format = (v: bigint) => {
    const d = (v % 10000n).toString().padStart(4, '0').replace(/0+$/, '');
    return (v / 10000n).toString() + (d ? '.' + d : '');
  };
  for (const item of items)
    if (item.cost) {
      const c = item.cost;
      const total = sums.get(c.currencyCode) ?? {
        invoice: 0n,
        paid: 0n,
        remaining: 0n,
      };
      total.invoice += units(c.invoiceAmount);
      total.paid += units(c.paidAmount);
      total.remaining += units(c.remainingAmount);
      sums.set(c.currencyCode, total);
    }
  return {
    unpriced: items.filter((i) => i.stage === 'UNPRICED').length,
    pending: items.filter((i) =>
      ['READY_FOR_PAYMENT', 'PAYING'].includes(i.stage),
    ).length,
    paid: items.filter((i) => i.stage === 'PAID').length,
    totals: [...sums].map(([currencyCode, t]) => ({
      currencyCode,
      invoice: format(t.invoice),
      paid: format(t.paid),
      remaining: format(t.remaining),
    })),
  };
}
