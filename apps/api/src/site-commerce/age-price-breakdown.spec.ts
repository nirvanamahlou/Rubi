import { describe, expect, it } from 'vitest';
import { Prisma } from '@nora/database';
import type { TicketOfferV1 } from '@nora/contracts';
import {
  ageFareBreakdown,
  ageFareTotal,
} from '../ticket-catalog/ticket-age-fares';
import { websiteFlightQuotes } from './ticket-quote';

const counts = { adults: 1, children: 1, infants: 1 };
const fare = {
  revision: 1,
  amount: '100',
  childAmount: '40',
  infantAmount: '0.01',
  currencyCode: 'IRR',
};
const outbound = {
  id: 'out',
  branchId: 'branch',
  originId: 'a',
  destinationId: 'b',
  departureAt: '2035-01-01T10:00:00Z',
  arrivalAt: '2035-01-01T12:00:00Z',
  remainingCapacity: 20,
  standaloneSalePrice: fare,
} as unknown as TicketOfferV1;
const returning = {
  ...outbound,
  id: 'back',
  originId: 'b',
  destinationId: 'a',
  departureAt: '2035-01-04T10:00:00Z',
  arrivalAt: '2035-01-04T12:00:00Z',
  standaloneSalePrice: {
    ...fare,
    amount: '200',
    childAmount: '70',
    infantAmount: '8',
  },
} as unknown as TicketOfferV1;
const sum = (amounts: string[]) =>
  amounts
    .reduce((total, amount) => total.add(amount), new Prisma.Decimal(0))
    .toFixed(2);

describe('authoritative age-price presentation', () => {
  it('rejects floating inventory in either flight direction before calculating a booking quote', () => {
    expect(() =>
      websiteFlightQuotes(
        { ...outbound, supplyType: 'FLOATING' },
        undefined,
        2,
        counts,
      ),
    ).toThrow('رزرو اینترنتی ندارد');
    expect(() =>
      websiteFlightQuotes(
        outbound,
        { ...returning, supplyType: 'FLOATING' },
        2,
        counts,
      ),
    ).toThrow('رزرو اینترنتی ندارد');
  });
  it('uses explicit child and free-infant rates without a percentage assumption', () => {
    expect(ageFareBreakdown({ ...fare, infantAmount: '0' }, counts, 0)).toEqual(
      {
        totalAmount: '140.00',
        passengers: [
          { category: 'ADT', amount: '100.00' },
          { category: 'CHD', amount: '40.00' },
          { category: 'INF', amount: '0.00' },
        ],
      },
    );
  });
  it('preserves legacy child seat pricing across occupied tiers and free infants', () => {
    const price = {
      amount: '100',
      tiers: [
        { seatCount: 2, amount: '100' },
        { seatCount: 5, amount: '200' },
      ],
    };
    const result = ageFareBreakdown(
      price,
      { adults: 2, children: 1, infants: 1 },
      1,
    );
    expect(result.passengers.map((p) => p.amount)).toEqual([
      '100.00',
      '200.00',
      '200.00',
      '0.00',
    ]);
    expect(result.totalAmount).toBe('500.00');
  });
  it('describes a paired fare once, without adding either standalone fare', () => {
    const paired = {
      ...outbound,
      roundTripSalePrices: [{ ...fare, returnOfferId: returning.id }],
    };
    const result = websiteFlightQuotes(paired, returning, 2, counts, true);
    expect(result.map((p) => p.amount)).toEqual(['70.00', '70.01']);
    expect(result[0]?.pricingBreakdown).toMatchObject({
      coverage: 'round_trip',
      totalAmount: '140.01',
    });
    expect(result[1]?.pricingBreakdown).toBeUndefined();
    expect(
      sum(result[0]!.pricingBreakdown!.passengers.map((p) => p.amount)),
    ).toBe(sum(result.map((p) => p.amount)));
  });
  it('keeps two independent one-way quote breakdowns separate', () => {
    const result = websiteFlightQuotes(outbound, returning, 2, counts, true);
    expect(result.map((p) => p.pricingBreakdown?.coverage)).toEqual([
      'one_way',
      'one_way',
    ]);
    for (const quote of result)
      expect(sum(quote.pricingBreakdown!.passengers.map((p) => p.amount))).toBe(
        quote.amount,
      );
    expect(sum(result.map((p) => p.amount))).toBe('418.01');
  });
  it('conserves sub-cent rounding without negative passenger prices', () => {
    const price = {
      amount: '0.0049',
      childAmount: '0.006',
      infantAmount: '0.0001',
    };
    const group = { adults: 2, children: 1, infants: 1 };
    const result = ageFareBreakdown(price, group, 0);
    expect(sum(result.passengers.map((p) => p.amount))).toBe(
      ageFareTotal(price, group, 0).toFixed(2),
    );
    expect(
      result.passengers.every((p) => new Prisma.Decimal(p.amount).gte(0)),
    ).toBe(true);
  });
  it('retains exact values above the JavaScript safe-integer limit', () => {
    const result = ageFareBreakdown(
      { amount: '9007199254740993', childAmount: '1', infantAmount: '0' },
      counts,
      0,
    );
    expect(result.totalAmount).toBe('9007199254740994.00');
    expect(result.passengers[0]?.amount).toBe('9007199254740993.00');
  });
  it('does not change legacy quote response fields or native arithmetic', () => {
    expect(websiteFlightQuotes(outbound, undefined, 2, counts)).toEqual([
      { amount: '140.01', currencyCode: 'IRR' },
    ]);
  });
  it('fails closed when the tier capacity cannot cover the selected seats', () => {
    expect(() =>
      ageFareBreakdown(
        { ...fare, tiers: [{ seatCount: 1, amount: '100' }] },
        counts,
        0,
      ),
    ).toThrow();
    expect(() =>
      ageFareBreakdown(fare, { adults: 31, children: 0, infants: 0 }, 0),
    ).toThrow();
  });
});
