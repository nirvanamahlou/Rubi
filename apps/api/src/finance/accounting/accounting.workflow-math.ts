import { ConflictException } from '@nestjs/common';
import { Prisma } from '@nora/database';
export const Exact = Prisma.Decimal.clone({ precision: 60 });
export const decimal = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{1,20}(?:\.\d{1,4})?$/.test(value))
    throw new ConflictException('مبلغ دقیق با حداکثر چهار رقم اعشار لازم است.');
  return new Exact(value);
};
export function settlementPortion(
  totalForeign: string,
  totalBase: string,
  previousForeign: string,
  previousBase: string,
  foreign: string,
  scale: number,
) {
  const remainingForeign = new Exact(totalForeign).sub(previousForeign),
    remainingBase = new Exact(totalBase).sub(previousBase),
    amount = decimal(foreign);
  if (!amount.gt(0) || amount.gt(remainingForeign) || remainingBase.lt(0))
    throw new ConflictException('مبلغ تسویه از مانده مبنای دفتری بیشتر است.');
  return amount.eq(remainingForeign)
    ? remainingBase
    : remainingBase
        .mul(amount)
        .div(remainingForeign)
        .toDecimalPlaces(scale, Prisma.Decimal.ROUND_HALF_UP);
}
export function revenueAmounts(
  components: readonly { type: string; amount: string; currencyCode: string }[],
  currency: string,
  mode: string,
  fee?: unknown,
) {
  let net = new Exact(0),
    tax = new Exact(0);
  for (const c of components.filter((c) => c.currencyCode === currency)) {
    if (c.type === 'TAX') tax = tax.add(c.amount);
    else net = net.add(new Exact(c.amount).mul(c.type === 'DISCOUNT' ? -1 : 1));
  }
  if (!net.gt(0) || !['PRINCIPAL', 'AGENT'].includes(mode))
    throw new ConflictException(
      'مبنای مثبت درآمد و نقش اصیل یا نماینده را مشخص کنید.',
    );
  const earned = mode === 'AGENT' ? decimal(fee) : net;
  if (!earned.gt(0) || earned.gt(net))
    throw new ConflictException(
      'درآمد کارمزدی باید مثبت و حداکثر برابر مبلغ خالص قرارداد باشد.',
    );
  return {
    net: net.toString(),
    tax: (mode === 'PRINCIPAL' ? tax : new Exact(0)).toString(),
    earned: earned.toString(),
    gross: earned.add(mode === 'PRINCIPAL' ? tax : 0).toString(),
    passThrough: mode === 'AGENT' ? net.sub(earned).toString() : '0',
  };
}
