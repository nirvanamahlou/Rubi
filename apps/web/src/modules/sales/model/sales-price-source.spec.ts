import { describe, expect, it } from 'vitest';
import type {
  TicketOfferV1,
  PackageTourSalesPriceChoiceV1,
} from '@nora/contracts';
import { emptySalesForm } from './sales-form';
import {
  standaloneTicketPricing,
  publishedTourServicePricing,
} from './sales-price-source';

const offer: TicketOfferV1 = {
  id: 'offer',
  version: 1,
  branchId: 'branch',
  originId: 'origin',
  destinationId: 'destination',
  departureAt: '2099-10-01T10:00:00.000Z',
  arrivalAt: '2099-10-01T12:00:00.000Z',
  carrierName: 'Synthetic airline',
  serviceNumber: 'TEST-100',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 10,
  remainingCapacity: 10,
  status: 'ACTIVE',
  standaloneSalePrice: { revision: 2, amount: '1200000', currencyCode: 'IRR' },
};

describe('Sales price sources', () => {
  it('quotes seats from the standalone fare for a flight-only sale', () => {
    const state = { ...emptySalesForm, serviceKinds: ['FLIGHT' as const] };
    expect(
      standaloneTicketPricing(state, offer, 'OUTBOUND', 3)['flight-outbound'],
    ).toEqual([
      {
        version: 1,
        currencyCode: 'IRR',
        daySale: { basis: 'TOTAL', amount: '3600000' },
        agreed: { basis: 'TOTAL', amount: '3600000' },
      },
    ]);
  });
  it('uses the published tour rate exactly once across both flights and one hotel room', () => {
    const choice: PackageTourSalesPriceChoiceV1 = {
      publicationId: 'pub-2',
      priceVersion: 2,
      tourVersion: 1,
      hotelRateId: 'rate',
      hotelId: 'hotel',
      hotelName: 'Synthetic hotel',
      roomCode: 'doubleChild',
      checkIn: '2099-10-01',
      checkOut: '2099-10-06',
      currencyCode: 'EUR',
      adultFlightSale: '100',
      childFlightSale: '50',
      businessUplift: '20',
      hotelSale: '600',
      publishedAt: '2099-09-01T00:00:00.000Z',
    };
    const state = {
      ...emptySalesForm,
      passengerComposition: { adults: 2, children: 1, infants: 1 },
      serviceKinds: ['FLIGHT' as const, 'HOTEL' as const],
      tour: {
        outbound: { cabinClassCode: 'BUSINESS' },
        returning: { cabinClassCode: 'ECONOMY' },
      } as never,
    };
    const result = publishedTourServicePricing(state, choice);
    expect(result['flight-outbound']?.[0]?.daySale.amount).toBe('145');
    expect(result['flight-return']?.[0]?.daySale.amount).toBe('145');
    expect(result.hotel?.[0]?.daySale.amount).toBe('600');
    expect(result['flight-outbound']?.[0]?.currencyCode).toBe('EUR');
  });
  it('keeps published tour and hotel quotations independent from the ticket list fare', () => {
    const existing = {
      'flight-outbound': [
        {
          version: 1 as const,
          currencyCode: 'IRR',
          daySale: { basis: 'TOTAL' as const, amount: '5000000' },
          agreed: { basis: 'TOTAL' as const, amount: '5000000' },
        },
      ],
    };
    const state = {
      ...emptySalesForm,
      serviceKinds: ['FLIGHT' as const, 'HOTEL' as const],
      servicePricing: existing,
    };
    expect(standaloneTicketPricing(state, offer, 'OUTBOUND', 3)).toEqual(
      existing,
    );
    expect(
      standaloneTicketPricing(
        { ...state, serviceKinds: ['FLIGHT'], tour: {} as never },
        offer,
        'OUTBOUND',
        3,
      ),
    ).toEqual(existing);
  });
});
