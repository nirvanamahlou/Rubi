import { describe, expect, it } from 'vitest';
import type { TicketOfferV1 } from '@nora/contracts';
import { roundTripPricesByOutbound } from './round-trip-prices';

const offer = (id: string, departureAt: string): TicketOfferV1 => ({
  id,
  version: 1,
  branchId: 'branch',
  originId: 'origin',
  destinationId: 'destination',
  departureAt,
  arrivalAt: departureAt,
  carrierName: 'Carrier',
  serviceNumber: id,
  cabinClassCode: 'ECONOMY',
  totalCapacity: 20,
  remainingCapacity: 20,
  status: 'ACTIVE',
});

describe('round-trip prices by outbound', () => {
  it('keeps every fare attached to its own return flight and date', () => {
    const outbound: TicketOfferV1 = {
      ...offer('outbound', '2026-10-01T08:00:00.000Z'),
      roundTripSalePrices: [
        {
          returnOfferId: 'return-early',
          amount: '1200',
          currencyCode: 'IRR',
          revision: 2,
        },
        {
          returnOfferId: 'return-late',
          amount: '1450',
          currencyCode: 'IRR',
          revision: 1,
        },
      ],
    };
    const early = offer('return-early', '2026-10-05T10:30:00.000Z');
    const late = offer('return-late', '2026-10-09T15:45:00.000Z');

    const fares = roundTripPricesByOutbound([outbound, early, late]).get(
      'outbound',
    );

    expect(fares).toHaveLength(2);
    expect(
      fares?.map(({ price, returning }) => ({
        amount: price.amount,
        returnOfferId: returning?.id,
        returnDate: returning?.departureAt,
      })),
    ).toEqual([
      {
        amount: '1200',
        returnOfferId: 'return-early',
        returnDate: '2026-10-05T10:30:00.000Z',
      },
      {
        amount: '1450',
        returnOfferId: 'return-late',
        returnDate: '2026-10-09T15:45:00.000Z',
      },
    ]);
  });

  it('retains a fare if its referenced return flight is absent from the page', () => {
    const outbound: TicketOfferV1 = {
      ...offer('outbound', '2026-10-01T08:00:00.000Z'),
      roundTripSalePrices: [
        {
          returnOfferId: 'not-loaded',
          amount: '1200',
          currencyCode: 'IRR',
          revision: 1,
        },
      ],
    };

    const fares = roundTripPricesByOutbound([outbound]).get('outbound');

    expect(fares).toHaveLength(1);
    expect(fares?.[0]?.returning).toBeUndefined();
    expect(fares?.[0]?.price.returnOfferId).toBe('not-loaded');
  });
});
