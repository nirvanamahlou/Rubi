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
    expect(new Set(masterDataCatalog.map((item) => item.key)).size).toBe(12);
  });

  it('defines required fields and an explicitly non-persistent preview', () => {
    for (const resource of masterDataResourceKeys) {
      const definition = getMasterDataDefinition(resource);
      expect(definition.fields.some((field) => field.required)).toBe(true);
      expect(Object.keys(definition.preview).length).toBeGreaterThan(1);
    }
  });
});
