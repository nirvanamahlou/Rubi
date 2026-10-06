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
      catalogSaleQuoteVersion: 1,
      catalogSaleQuoteAmount: '100',
      catalogSaleQuoteCurrency: 'IRR',
    }),
  ).toEqual({ amount: '100', currencyCode: 'IRR' });
  expect(expectedTicketSale(price)).toEqual({
    amount: '95',
    currencyCode: 'IRR',
  });
});
it('rejects malformed quote metadata rather than bypassing the public catalog guard', () => {
  for (const amount of [null, undefined, 'oops', '-1'])
    expect(() =>
      expectedTicketSale(price, {
        catalogSaleQuoteVersion: 1,
        catalogSaleQuoteAmount: amount,
        catalogSaleQuoteCurrency: 'IRR',
      }),
    ).toThrow();
});

it('checks catalog quote freshness without requiring a service-level sale amount', () => {
  expect(
    expectedTicketSale(undefined, {
      catalogSaleQuoteVersion: 1,
      catalogSaleQuoteAmount: '125.0001',
      catalogSaleQuoteCurrency: 'USD',
    }),
  ).toEqual({ amount: '125.0001', currencyCode: 'USD' });
  expect(() => expectedTicketSale(undefined)).toThrow();
});
