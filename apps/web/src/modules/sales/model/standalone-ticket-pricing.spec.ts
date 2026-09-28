import { describe, expect, it } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import { emptySalesForm } from './sales-form';
import {
  repriceStandaloneTicketSelections,
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
});
