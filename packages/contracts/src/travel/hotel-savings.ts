export interface HotelPurchaseSavingsV1 {
  version: 1;
  status: 'AVAILABLE' | 'UNAVAILABLE';
  reason: string | null;
  referenceAmount: string | null;
  actualAmount: string | null;
  savingsAmount: string | null;
  currencyCode: string;
  capturedAt: string;
  sourceBatchId: string | null;
  sourceBrokerName: string | null;
  checkIn: string;
  checkOut: string;
}
/** Only server-produced evidence is persisted; older purchases have no comparison. */
export function hotelPurchaseSavingsEvidence(
  value: unknown,
): HotelPurchaseSavingsV1 | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  const item = (value as { hotelSavings?: HotelPurchaseSavingsV1 })
    .hotelSavings;
  if (
    item?.version !== 1 ||
    !['AVAILABLE', 'UNAVAILABLE'].includes(item.status) ||
    !/^[A-Z]{3}$/.test(item.currencyCode)
  )
    return undefined;
  const money = (amount: unknown, signed = false) =>
    typeof amount === 'string' &&
    (signed ? /^-?\d{1,24}(?:\.\d{1,4})?$/ : /^\d{1,24}(?:\.\d{1,4})?$/).test(
      amount,
    );
  if (
    item.status === 'AVAILABLE' &&
    (!money(item.referenceAmount) ||
      (item.actualAmount !== null && !money(item.actualAmount)) ||
      (item.savingsAmount !== null && !money(item.savingsAmount, true)))
  )
    return undefined;
  return item;
}
