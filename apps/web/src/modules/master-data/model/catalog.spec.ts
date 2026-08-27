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
    expect(new Set(masterDataCatalog.map((item) => item.key)).size).toBe(15);
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
    ).toHaveLength(3);
  });

  it('defines required fields without exposing the internal code', () => {
    for (const resource of masterDataResourceKeys) {
      const definition = getMasterDataDefinition(resource);
      expect(definition.fields.some((field) => field.required)).toBe(true);
      expect(definition.fields.some((field) => field.key === 'code')).toBe(
        false,
      );
      expect(Object.keys(definition.preview).length).toBeGreaterThan(1);
    }
  });
});
