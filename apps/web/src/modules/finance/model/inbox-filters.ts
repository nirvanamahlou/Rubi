import type { FinanceInboxItemV1 } from '@nora/contracts';

/** Gregorian date from DatePicker, interpreted as a Tehran calendar day. */
export function inTehranDateRange(createdAt: string, from: string, to: string) {
  const stamp = Date.parse(createdAt);
  if (!Number.isFinite(stamp)) return false;
  const start = from ? Date.parse(`${from}T00:00:00+03:30`) : -Infinity;
  const end = to ? Date.parse(`${to}T00:00:00+03:30`) + 86_400_000 : Infinity;
  return stamp >= start && stamp < end;
}

export function isActionablePayment(item: FinanceInboxItemV1) {
  return (
    item.kind === 'PAYMENT_REQUEST' &&
    item.amount !== null &&
    (item.status === 'READY_FOR_PAYMENT' || item.status === 'PAYING')
  );
}
