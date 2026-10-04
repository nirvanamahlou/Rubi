import { BadRequestException } from '@nestjs/common';
import { moneyUnits, type SalesServicePricingV1 } from '@nora/contracts';
/** A catalog quote is a freshness guard, independent of the customer agreement. */
export function expectedTicketSale(
  price: SalesServicePricingV1,
  metadata?: Readonly<Record<string, unknown>> | null,
) {
  const quote = metadata?.catalogSaleQuote;
  if (quote === undefined)
    return { amount: price.daySale.amount, currencyCode: price.currencyCode };
  if (
    !quote ||
    typeof quote !== 'object' ||
    !('version' in quote) ||
    quote.version !== 1 ||
    !('amount' in quote) ||
    typeof quote.amount !== 'string' ||
    !('currencyCode' in quote) ||
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
