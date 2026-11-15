import { BadRequestException } from '@nestjs/common';
import { moneyUnits, type SalesServicePricingV1 } from '@nora/contracts';
/** A catalog quote is a freshness guard, independent of the customer agreement. */
export function expectedTicketSale(
  price: SalesServicePricingV1 | undefined,
  metadata?: Readonly<Record<string, unknown>> | null,
) {
  const version = metadata?.catalogSaleQuoteVersion;
  if (version === undefined && price)
    return { amount: price.daySale.amount, currencyCode: price.currencyCode };
  const quote = {
    amount: metadata?.catalogSaleQuoteAmount,
    currencyCode: metadata?.catalogSaleQuoteCurrency,
  };
  if (
    version !== 1 ||
    typeof quote.amount !== 'string' ||
    typeof quote.currencyCode !== 'string' ||
    !/^[A-Z]{3}$/.test(quote.currencyCode)
  )
    throw new BadRequestException(
      'نرخ مرجع بلیط معتبر نیست؛ بلیط را دوباره انتخاب کنید.',
    );
  try {
    if (moneyUnits(quote.amount) < 0n) throw new Error();
  } catch {
    throw new BadRequestException('مبلغ نرخ مرجع بلیط معتبر نیست.');
  }
  const target = metadata?.catalogSalePriceTargetId;
  if (
    target !== undefined &&
    target !== null &&
    (typeof target !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        target,
      ))
  )
    throw new BadRequestException('نرخ مرجع پرواز تغییر کرده است.');
  return {
    amount: quote.amount,
    currencyCode: quote.currencyCode,
    ...(typeof target === 'string' ? { salePriceTargetId: target } : {}),
  };
}
