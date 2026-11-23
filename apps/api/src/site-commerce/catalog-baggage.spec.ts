import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedActor } from '@nora/contracts';
import { SiteCommerceService } from './site-commerce.service';

afterEach(() => vi.unstubAllEnvs());

async function catalogFlight(
  cabinClassCode: string,
  economyBaggageKg: string | null,
  businessBaggageKg: string | null,
) {
  const actor = {
    userId: 'synthetic-site',
    branchIds: ['synthetic-branch'],
    permissions: ['sales.contracts.create'],
  } as AuthenticatedActor;
  vi.stubEnv(
    'SITE_COMMERCE_BINDINGS',
    JSON.stringify({
      nss: { userId: actor.userId, branchId: actor.branchIds[0] },
    }),
  );
  const db = {
    client: {
      websiteCatalogDelivery: {
        findUnique: vi.fn().mockResolvedValue({
          branchId: actor.branchIds[0],
          salePriceTargetId: 'synthetic-target',
        }),
      },
      websiteOrder: { findMany: vi.fn().mockResolvedValue([]) },
      websitePublication: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'synthetic-publication',
            kind: 'ticket',
            resourceId: 'synthetic-offer',
            enabled: true,
            version: 1,
          },
        ]),
      },
    },
  };
  const tickets = {
    websiteOffer: vi.fn().mockResolvedValue({
      id: 'synthetic-offer',
      originId: 'origin',
      destinationId: 'destination',
      cabinClassCode,
      economyBaggageKg,
      businessBaggageKg,
      remainingCapacity: 4,
    }),
  };
  const references = {
    detail: vi.fn().mockImplementation(async (resource: string) => ({
      data:
        resource === 'countries'
          ? { code: 'IR' }
          : { name: 'Synthetic city', attributes: { countryId: 'country' } },
    })),
  };
  const service = new SiteCommerceService(
    db as never,
    tickets as never,
    {} as never,
    {} as never,
    { cancelledWebsiteContracts: vi.fn().mockResolvedValue([]) } as never,
    {} as never,
    references as never,
    {} as never,
    {} as never,
    {} as never,
  );
  return (await service.catalog('nss', actor)).data[0];
}

describe('website selected-cabin baggage contract', () => {
  const cases: [string, string | null, string | null, string | null][] = [
    ['ECONOMY', '20', '30', '20'],
    ['BUSINESS', '20', '30', '30'],
    ['ECONOMY', '0', '30', '0'],
    ['BUSINESS', '20', null, null],
    ['ECONOMY', null, '30', null],
  ];
  it.each(cases)(
    'projects %s baggage without substituting another cabin',
    async (cabin, economy, business, expected) => {
      expect(await catalogFlight(cabin, economy, business)).toMatchObject({
        enabled: true,
        flight: {
          baggageAllowanceKg: expected,
          economyBaggageKg: economy,
          businessBaggageKg: business,
        },
      });
    },
  );
});
