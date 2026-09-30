import { describe, expect, it } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import { emptySalesForm } from './sales-form';
import {
  repriceStandaloneTicketSelections,
  seatTierTotal,
  standaloneTicketPricing,
} from './standalone-ticket-pricing';

const offer = (id: string, amount: string): TicketOfferV1 => ({
  id,
  version: 1,
  branchId: 'branch',
  originId: 'origin',
  destinationId: 'destination',
  departureAt: '2026-10-01T08:00:00.000Z',
  arrivalAt: '2026-10-01T10:00:00.000Z',
  carrierName: 'Carrier',
  serviceNumber: id,
  cabinClassCode: 'ECONOMY',
  totalCapacity: 20,
  remainingCapacity: 20,
  status: 'ACTIVE',
  standaloneSalePrice: { revision: 1, amount, currencyCode: 'IRR' },
});

describe('standalone ticket pricing', () => {
  it('adds consecutive seat tiers across a boundary without floating-point rounding', () => {
    expect(
      seatTierTotal(
        '100.25',
        [
          { seatCount: 20, amount: '100.25' },
          { seatCount: 15, amount: '120.5' },
        ],
        19,
        3,
      ),
    ).toBe('341.25');
    expect(seatTierTotal('100.25', undefined, 19, 3)).toBe('300.75');
  });

  it('quotes the next available tier for an already partly sold offer', () => {
    const selected = offer('OUT', '100');
    selected.remainingCapacity = 4;
    selected.standaloneSalePrice = {
      revision: 2,
      amount: '100',
      currencyCode: 'IRR',
      tiers: [
        { seatCount: 15, amount: '100' },
        { seatCount: 5, amount: '200' },
      ],
    };
    expect(
      standaloneTicketPricing(emptySalesForm, selected, 'OUTBOUND', 2)[
        'flight-outbound'
      ]?.[0]?.agreed.amount,
    ).toBe('400');
  });

  it('prices outbound and return independently for all seated passengers', () => {
    const outbound = standaloneTicketPricing(
      emptySalesForm,
      offer('OUT', '1000000'),
      'OUTBOUND',
      3,
    );
    const both = standaloneTicketPricing(
      { ...emptySalesForm, servicePricing: outbound },
      offer('RET', '800000'),
      'RETURN',
      3,
    );
    expect(both['flight-outbound']?.[0]?.agreed.amount).toBe('3000000');
    expect(both['flight-return']?.[0]?.agreed.amount).toBe('2400000');
  });

  it('leaves package pricing unchanged when a hotel is selected', () => {
    const current = {
      hotel: [
        {
          version: 1 as const,
          currencyCode: 'IRR',
          daySale: { basis: 'TOTAL' as const, amount: '9' },
          agreed: { basis: 'TOTAL' as const, amount: '9' },
        },
      ],
    };
    expect(
      standaloneTicketPricing(
        {
          ...emptySalesForm,
          serviceKinds: ['FLIGHT', 'HOTEL'],
          servicePricing: current,
        },
        offer('OUT', '1000000'),
        'OUTBOUND',
        2,
      ),
    ).toBe(current);
  });

  it('fails closed when a round trip has no combined fare', () => {
    const prices = repriceStandaloneTicketSelections(
      {
        ...emptySalesForm,
        outboundOffer: offer('OUT', '1000000'),
        returnOffer: offer('RET', '800000'),
      },
      4,
    );
    expect(prices['flight-outbound']).toBeUndefined();
    expect(prices['flight-return']).toBeUndefined();
  });

  it('uses the combined round-trip fare as the contract basis', () => {
    const outbound = {
      ...offer('OUT', '1000000'),
      roundTripSalePrices: [
        {
          returnOfferId: 'RET',
          revision: 2,
          amount: '1500001',
          currencyCode: 'IRR',
        },
      ],
    };
    const prices = repriceStandaloneTicketSelections(
      {
        ...emptySalesForm,
        outboundOffer: outbound,
        returnOffer: offer('RET', '800000'),
      },
      2,
    );
    expect(prices['flight-outbound']?.[0]?.agreed.amount).toBe('1500001');
    expect(prices['flight-return']?.[0]?.agreed.amount).toBe('1500001');
  });

  it('keeps legacy per-passenger round-trip splitting for fares without tiers', () => {
    const outbound = {
      ...offer('OUT', '1'),
      roundTripSalePrices: [
        {
          returnOfferId: 'RET',
          revision: 1,
          amount: '1.0001',
          currencyCode: 'IRR',
        },
      ],
    };
    const prices = repriceStandaloneTicketSelections(
      {
        ...emptySalesForm,
        outboundOffer: outbound,
        returnOffer: offer('RET', '1'),
      },
      3,
    );
    expect(prices['flight-outbound']?.[0]?.agreed.amount).toBe('1.5');
    expect(prices['flight-return']?.[0]?.agreed.amount).toBe('1.5003');
  });

  it('sums crossed round-trip tiers before splitting the two services', () => {
    const outbound = {
      ...offer('OUT', '1'),
      remainingCapacity: 1,
      roundTripSalePrices: [
        {
          returnOfferId: 'RET',
          revision: 2,
          amount: '100',
          currencyCode: 'IRR',
          tiers: [
            { seatCount: 19, amount: '100' },
            { seatCount: 1, amount: '200' },
          ],
        },
      ],
    };
    const prices = repriceStandaloneTicketSelections(
      {
        ...emptySalesForm,
        outboundOffer: outbound,
        returnOffer: offer('RET', '1'),
      },
      1,
    );
    expect(prices['flight-outbound']?.[0]?.agreed.amount).toBe('100');
    expect(prices['flight-return']?.[0]?.agreed.amount).toBe('100');
  });
});
