import { describe, expect, it } from 'vitest';

import {
  MASTER_DATA_API_PREFIX,
  MASTER_DATA_CONTRACT_VERSION,
  MASTER_DATA_RESOURCES,
  masterDataEndpoints,
} from '../src';

describe('master data public contract', () => {
  it('publishes a stable versioned resource catalog', () => {
    expect(MASTER_DATA_CONTRACT_VERSION).toBe(9);
    expect(MASTER_DATA_API_PREFIX).toBe('/api/v1/master-data');
    expect(MASTER_DATA_RESOURCES).toHaveLength(33);
    expect(new Set(MASTER_DATA_RESOURCES).size).toBe(33);
    expect(MASTER_DATA_RESOURCES.slice(0, 5)).toEqual([
      'countries',
      'regions',
      'cities',
      'airports',
      'terminals',
    ]);
    expect(MASTER_DATA_RESOURCES).toEqual(
      expect.arrayContaining([
        'bank-branches',
        'payment-methods',
        'suppliers',
        'travel-services',
        'organization-contacts',
        'hotel-chains',
        'room-types',
        'meal-services',
        'facilities',
        'composite-hotels',
        'aircraft-types',
        'cabin-classes',
        'baggage-rules',
        'manifest-templates',
        'rail-companies',
        'train-types',
        'bus-companies',
        'bus-types',
      ]),
    );
  });

  it('encodes identifiers in public endpoints', () => {
    expect(masterDataEndpoints.detail('countries', 'id/with space')).toBe(
      '/api/v1/master-data/countries/id%2Fwith%20space',
    );
    expect(masterDataEndpoints.hotelImportCommit('id/with space')).toBe(
      '/api/v1/master-data/hotel-imports/id%2Fwith%20space/commit',
    );
  });
});
