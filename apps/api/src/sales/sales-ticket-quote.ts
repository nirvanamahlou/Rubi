import { BadRequestException } from '@nestjs/common';
import { moneyUnits, type SalesServicePricingV1 } from '@nora/contracts';
/** A catalog quote is a freshness guard, independent of the customer agreement. */
export function expectedTicketSale(
  price: SalesServicePricingV1,
  metadata?: Readonly<Record<string, unknown>> | null,
) {
  const version = metadata?.catalogSaleQuoteVersion;
  if (version === undefined)
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
  return { amount: quote.amount, currencyCode: quote.currencyCode };
}
