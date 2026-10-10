import { ticketPriceExportRows } from './ticket-prices-export';
import {
  clearSavedCommissionDrafts,
  type TicketPriceRow,
} from './ticket-price-rows';
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

describe('saved commission refresh', () => {
  it('clears upper and lower company drafts after bulk save and preserves other target, branch and unpriced drafts', () => {
    const source = {
      id: 'lower',
      offer: { branchId: 'a' },
      base: { amount: '100', currencyCode: 'IRR', revision: 1 },
    } as TicketPriceRow;
    const rows = [
      { ...source, id: 'upper' },
      source,
      { ...source, id: 'other', offer: { branchId: 'b' } },
      { ...source, id: 'unpriced', base: undefined },
    ] as TicketPriceRow[];
    expect(
      clearSavedCommissionDrafts(
        {
          'upper:direct': '9',
          'lower:direct': '4',
          'upper:partner': '3',
          'other:direct': '8',
          'unpriced:direct': '7',
        },
        rows,
        source,
        'direct',
        true,
      ),
    ).toEqual({
      'upper:partner': '3',
      'other:direct': '8',
      'unpriced:direct': '7',
    });
    expect(
      clearSavedCommissionDrafts(
        { 'upper:direct': '9', 'lower:direct': '4' },
        rows,
        source,
        'direct',
        false,
      ),
    ).toEqual({ 'upper:direct': '9' });
  });
});

describe('flight cabins in ticket pricing', () => {
  it('places economy then business below the same flight while preserving independent prices and seats', () => {
    const economy = {
      ...outbound,
      id: 'economy',
      cabinClassCode: 'ECONOMY' as const,
      totalCapacity: 20,
      roundTripSalePrices: [],
    };
    const business = {
      ...economy,
      id: 'business',
      cabinClassCode: 'BUSINESS' as const,
      totalCapacity: 5,
      standaloneSalePrice: { amount: '300', currencyCode: 'IRR', revision: 1 },
    };
    const source = [business, returning, economy];
    const rows = ticketPriceRows(source);
    expect(rows.map((row) => row.id)).toEqual(['economy', 'business', 'back']);
    expect(rows[0]!.base?.amount).toBe('100');
    expect(rows[1]!.base?.amount).toBe('300');
    expect(rows.slice(0, 2).map((row) => row.offer.totalCapacity)).toEqual([
      20, 5,
    ]);
    expect(source.map((offer) => offer.id)).toEqual([
      'business',
      'back',
      'economy',
    ]);
  });
  it('keeps distinct branches and departures in their original flight group', () => {
    const business = {
      ...outbound,
      id: 'business',
      cabinClassCode: 'BUSINESS' as const,
      roundTripSalePrices: [],
    };
    const other = { ...business, id: 'other', branchId: 'another' };
    const later = {
      ...business,
      id: 'later',
      departureAt: '2027-01-02T21:00:00Z',
    };
    const economy = {
      ...business,
      id: 'economy',
      cabinClassCode: 'ECONOMY' as const,
    };
    expect(
      ticketPriceRows([business, other, later, economy]).map((row) => row.id),
    ).toEqual(['economy', 'business', 'other', 'later']);
  });
});

it('keeps hidden pairs in the management rows and marks their destinations in Excel', () => {
  const offer = {
    ...outbound,
    remainingCapacity: 50,
    baseStandaloneSalePrice: outbound.standaloneSalePrice,
    standaloneSalePrice: null,
    baseRoundTripSalePrices: outbound.roundTripSalePrices,
    roundTripSalePrices: [],
    saleCommissions: [
      {
        returnOfferId: null,
        salePriceTargetId: 'partner',
        revision: 1,
        percent: '100',
        amount: '0',
        currencyCode: 'IRR',
        isHidden: true,
      },
      {
        returnOfferId: 'back',
        salePriceTargetId: 'partner',
        revision: 1,
        percent: '100.0000',
        amount: '0',
        currencyCode: 'IRR',
      },
    ],
  } as TicketOfferV1;
  const rows = ticketPriceRows([offer]);
  expect(rows).toHaveLength(2);
  expect(rows[1]?.base?.amount).toBe('260');
  const exported = ticketPriceExportRows(
    rows,
    [
      {
        id: 'partner',
        branchId: 'branch',
        name: 'Partner',
        code: 'PARTNER',
        version: 1,
        isActive: true,
      },
    ],
    {},
  );
  expect(exported[1]?.slice(-2)).toEqual(['100', 'عدم نمایش']);
  expect(exported[2]?.slice(-2)).toEqual(['100.0000', 'عدم نمایش']);
});
