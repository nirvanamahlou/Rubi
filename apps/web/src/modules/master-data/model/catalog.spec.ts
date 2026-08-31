import { describe, expect, it } from 'vitest';

import {
  getMasterDataDefinition,
  masterDataCatalog,
  masterDataResourceKeys,
} from './catalog';

describe('master data catalog', () => {
  it('covers every Sprint 1 resource exactly once', () => {
    expect(masterDataCatalog.map((item) => item.key)).toEqual([
      ...masterDataResourceKeys,
    ]);
    expect(new Set(masterDataCatalog.map((item) => item.key)).size).toBe(
      masterDataResourceKeys.length,
    );
  });

  it('does not expose a hotel organization field', () => {
    expect(
      getMasterDataDefinition('hotels').fields.some(
        (field) => field.key === 'organizationId',
      ),
    ).toBe(false);
  });

  it('defines the complete geography fields and selector options', () => {
    expect(
      getMasterDataDefinition('airports').fields.map((field) => field.key),
    ).toEqual([
      'name',
      'englishName',
      'countryId',
      'cityId',
      'iataCode',
      'icaoCode',
      'ianaTimezone',
      'latitude',
      'longitude',
    ]);
    expect(
      getMasterDataDefinition('terminals').fields.find(
        (field) => field.key === 'terminalType',
      )?.options,
    ).toHaveLength(4);
    expect(
      getMasterDataDefinition('terminals').fields.map((field) => field.key),
    ).toEqual(
      expect.arrayContaining([
        'gateCount',
        'operatingHoursMode',
        'opensAt',
        'closesAt',
      ]),
    );
  });

  it('defines required fields and exposes only business-owned codes', () => {
    const explicitCodeResources = new Set([
      'currencies',
      'banks',
      'bank-branches',
      'payment-methods',
      'travel-services',
      'airlines',
    ]);
    for (const resource of masterDataResourceKeys) {
      const definition = getMasterDataDefinition(resource);
      expect(definition.fields.some((field) => field.required)).toBe(true);
      expect(definition.fields.some((field) => field.key === 'code')).toBe(
        explicitCodeResources.has(resource),
      );
      expect(Object.keys(definition.preview).length).toBeGreaterThan(1);
    }
  });

  it('defines the complete financial reference resources', () => {
    expect(
      getMasterDataDefinition('currencies').fields.map((field) => field.key),
    ).toEqual(['code', 'name', 'englishName', 'symbol', 'decimalDigits']);
    expect(
      getMasterDataDefinition('bank-branches').fields.map((field) => field.key),
    ).toEqual([
      'code',
      'name',
      'englishName',
      'bankId',
      'cityId',
      'address',
      'phone',
    ]);
    expect(
      getMasterDataDefinition('payment-methods').fields.find(
        (field) => field.key === 'channel',
      )?.options,
    ).toHaveLength(7);
  });

  it('defines normalized accommodation catalogs without manual internal codes', () => {
    expect(
      getMasterDataDefinition('hotels').fields.map((field) => field.key),
    ).toEqual(
      expect.arrayContaining([
        'chainId',
        'mealServiceIds',
        'roomTypeIds',
        'facilityIds',
      ]),
    );
    expect(
      getMasterDataDefinition('composite-hotels').fields.map(
        (field) => field.key,
      ),
    ).toContain('memberHotelIds');
    for (const resource of [
      'hotel-chains',
      'room-types',
      'meal-services',
      'facilities',
      'composite-hotels',
    ] as const)
      expect(
        getMasterDataDefinition(resource).fields.some(
          (field) => field.key === 'code',
        ),
      ).toBe(false);
  });
});
