import type { SalesMoney } from '@nora/contracts';
import { currencySymbol } from '@/lib/currency-symbol';

/** Shared exact display for supplier preview and server-generated PDF; never sums currencies. */
export function reservationFormPriceText(
  prices: readonly SalesMoney[],
  currencyDisplay: 'symbol' | 'code' = 'symbol',
) {
  return prices
    .map(({ amount, currencyCode }) => {
      const [whole = '', ...fraction] = amount.split('.');
      const formatted =
        whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') +
        (fraction.length ? '.' + fraction.join('.') : '');
      return `${formatted} ${currencyDisplay === 'code' ? currencyCode : currencySymbol(currencyCode)}`;
    })
    .join(' · ');
}
