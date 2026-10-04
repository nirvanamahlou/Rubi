import { expect, it } from 'vitest';
import { expectedTicketSale } from './sales-ticket-quote';
const price = {
  version: 1 as const,
  currencyCode: 'IRR',
  daySale: { basis: 'TOTAL' as const, amount: '95' },
  agreed: { basis: 'TOTAL' as const, amount: '95' },
};
it('keeps catalog freshness check separate from an agreed customer price', () => {
  expect(
    expectedTicketSale(price, {
      catalogSaleQuote: { version: 1, amount: '100', currencyCode: 'IRR' },
    }),
  ).toEqual({ amount: '100', currencyCode: 'IRR' });
  expect(expectedTicketSale(price)).toEqual({
    amount: '95',
    currencyCode: 'IRR',
  });
});
it('rejects malformed quote metadata rather than bypassing the public catalog guard', () => {
  for (const catalogSaleQuote of [
    null,
    {},
    { version: 1, amount: 'oops', currencyCode: 'IRR' },
    { version: 1, amount: '-1', currencyCode: 'IRR' },
  ])
    expect(() => expectedTicketSale(price, { catalogSaleQuote })).toThrow();
});
