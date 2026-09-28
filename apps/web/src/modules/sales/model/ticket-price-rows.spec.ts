import { describe, it, expect } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import {
  ticketPriceRows,
  filterTicketRows,
  normalizePercent,
  validPercent,
  netTicketPrice,
} from './ticket-price-rows';
const outbound = {
  id: 'out',
  branchId: 'branch',
  originId: 'tehran',
  destinationId: 'antalya',
  departureAt: '2027-01-01T21:00:00Z',
  carrierName: 'Air',
  serviceNumber: '12',
  standaloneSalePrice: { amount: '100', currencyCode: 'IRR', revision: 1 },
  roundTripSalePrices: [
    {
      returnOfferId: 'back',
      amount: '250',
      baseAmount: '260',
      currencyCode: 'IRR',
      revision: 2,
    },
  ],
} as unknown as TicketOfferV1;
const returning = {
  ...outbound,
  id: 'back',
  originId: 'antalya',
  destinationId: 'tehran',
  departureAt: '2027-01-08T10:00:00Z',
  roundTripSalePrices: [],
} as TicketOfferV1;
const filters = {
  originId: '',
  destinationId: '',
  tripType: 'ALL',
  query: '',
  from: '',
  to: '',
};
describe('unified ticket price rows', () => {
  it('keeps both legs in one pair row alongside one-way tickets and uses the original pair base', () => {
    const rows = ticketPriceRows([outbound, returning]);
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({
      returnOfferId: 'back',
      returning,
      base: { amount: '260', revision: 2 },
    });
  });
  it('combines route, trip and inclusive Tehran-day filters', () => {
    const rows = ticketPriceRows([outbound, returning]);
    expect(
      filterTicketRows(
        rows,
        {
          ...filters,
          originId: 'tehran',
          destinationId: 'antalya',
          tripType: 'ROUNDTRIP',
          from: '2027-01-02',
          to: '2027-01-02',
        },
        (o) => o.serviceNumber,
      ),
    ).toHaveLength(1);
    expect(
      filterTicketRows(
        rows,
        { ...filters, originId: 'antalya', tripType: 'ONEWAY' },
        (o) => o.serviceNumber,
      ),
    ).toHaveLength(1);
    expect(
      filterTicketRows(
        rows,
        { ...filters, originId: 'tehran', destinationId: 'tehran' },
        (o) => o.serviceNumber,
      ),
    ).toHaveLength(0);
  });
  it('searches either leg and handles an unavailable return without crashing', () => {
    expect(
      filterTicketRows(
        ticketPriceRows([
          outbound,
          { ...returning, serviceNumber: 'RETURN-77' },
        ]),
        { ...filters, query: 'return-77', tripType: 'ROUNDTRIP' },
        (o) => o.serviceNumber,
      ),
    ).toHaveLength(1);
    expect(ticketPriceRows([outbound])[1]?.returning).toBeUndefined();
  });
});
describe('commission price preview', () => {
  it('normalizes Persian digits and accepts zero/fractional percentages', () => {
    expect(normalizePercent('۴٫۱۲۵۰')).toBe('4.1250');
    expect(validPercent('0')).toBe(true);
    expect(validPercent('100')).toBe(true);
    for (const p of ['100.0001', '-1', '101', 'NaN', '', '1.00001'])
      expect(validPercent(p)).toBe(false);
  });
  it('subtracts commission using exact money units and four-decimal half-up rounding', () => {
    expect(netTicketPrice('250000000', '0')).toBe('250000000');
    expect(netTicketPrice('250000000', '3')).toBe('242500000');
    expect(netTicketPrice('250000000', '4')).toBe('240000000');
    expect(netTicketPrice('9999999999999999.9999', '0.0001')).toBe(
      '9999989999999999.9999',
    );
    expect(netTicketPrice('0.0001', '50')).toBe('0.0001');
    expect(netTicketPrice('100', '100')).toBe('0');
    expect(netTicketPrice('100', 'bad')).toBeUndefined();
  });
});
