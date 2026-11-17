import { createHash } from 'node:crypto';
import { moneyUnits } from '@nora/contracts';
import { ConflictException, BadRequestException } from '@nestjs/common';
export const CHECKOUT_HOLD_MS = 10 * 60 * 1000;
export type CheckoutCounts = { adults: number; children: number; infants: number };
export function checkoutSeatCount(counts: CheckoutCounts) {
  if (![counts.adults, counts.children, counts.infants].every(n => Number.isSafeInteger(n) && n >= 0)
      || counts.adults + counts.children < 1 || counts.adults + counts.children + counts.infants > 30)
    throw new BadRequestException('ترکیب مسافران معتبر نیست.');
  return counts.adults + counts.children;
}
export function checkoutQuoteFingerprint(quote: { amount: string; currencyCode: string; salePriceTargetId?: string; passengerCounts?: CheckoutCounts }) {
  return createHash('sha256').update(JSON.stringify([
    moneyUnits(quote.amount).toString(), quote.currencyCode, quote.salePriceTargetId ?? null,
    quote.passengerCounts ? [quote.passengerCounts.adults, quote.passengerCounts.children, quote.passengerCounts.infants] : null,
  ])).digest('hex');
}
export function checkoutHoldIsLive(hold: {status:string; expiresAt:Date; paymentPendingAt:Date|null}, now:Date) {
 return hold.status === 'ACTIVE' && (hold.paymentPendingAt !== null || hold.expiresAt > now);
}
export function assertCheckoutHoldReplay(holds: readonly {offerId:string;quantity:number;status:string;expiresAt:Date;paymentPendingAt:Date|null}[], ids: readonly string[], quantity:number, now:Date) {
 if (holds.length!==ids.length || holds.some(h=>!ids.includes(h.offerId)||h.quantity!==quantity||!checkoutHoldIsLive(h,now)))
   throw new ConflictException('مهلت یا ظرفیت رزرو تغییر کرده است؛ دوباره استعلام کنید.');
}
