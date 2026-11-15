import { describe, it, expect } from 'vitest';
import { Prisma } from '@nora/database';
import type { TicketOfferV1 } from '@nora/contracts';
import { applySaleCommissions } from './ticket-sale-commissions';
import { websiteTargetOffer } from './website-target-offer';
const raw: TicketOfferV1 = {
  id: 'offer',
  version: 1,
  branchId: 'branch',
  originId: 'origin',
  destinationId: 'destination',
  departureAt: '2099-01-01T08:00:00.000Z',
  arrivalAt: '2099-01-01T10:00:00.000Z',
  carrierName: 'Synthetic',
  serviceNumber: 'S1',
  cabinClassCode: 'ECONOMY',
  totalCapacity: 3,
  remainingCapacity: 3,
  allocatedCapacity: 0,
  reservedCapacity: 0,
  status: 'ACTIVE',
  standaloneSalePrice: {
    revision: 1,
    amount: '100',
    currencyCode: 'IRR',
    tiers: [{ seatCount: 3, amount: '100' }],
  },
  roundTripSalePrices: [
    {
      returnOfferId: 'return',
      revision: 1,
      amount: '250',
      currencyCode: 'IRR',
    },
  ],
};
describe('website saved sales destination fares', () => {
  it('uses destination rates independently of direct-sale discounts, for one-way, pair and tiers', () => {
    const offer = applySaleCommissions(raw, [
      {
        returnOfferId: null,
        salePriceTargetId: null,
        revision: 1,
        percent: new Prisma.Decimal(50),
      },
      {
        returnOfferId: null,
        salePriceTargetId: 'nss',
        revision: 1,
        percent: new Prisma.Decimal(4),
      },
      {
        returnOfferId: 'return',
        salePriceTargetId: 'nss',
        revision: 1,
        percent: new Prisma.Decimal(10),
      },
    ]);
    const publicOffer = websiteTargetOffer(offer, 'nss');
    expect(offer.standaloneSalePrice?.amount).toBe('50');
    expect(publicOffer.standaloneSalePrice?.amount).toBe('96');
    expect(publicOffer.standaloneSalePrice?.tiers?.[0]?.amount).toBe('96');
    expect(publicOffer.roundTripSalePrices?.[0]?.amount).toBe('225');
  });
  it('never falls back to direct fares for a missing or hidden destination rate', () => {
    for (const rows of [
      [],
      [
        {
          returnOfferId: null,
          salePriceTargetId: 'nss',
          revision: 1,
          percent: new Prisma.Decimal(100),
        },
      ],
    ]) {
      const offer = websiteTargetOffer(applySaleCommissions(raw, rows), 'nss');
      expect(offer.standaloneSalePrice).toBeNull();
      expect(offer.roundTripSalePrices).toEqual([]);
    }
  });
});
