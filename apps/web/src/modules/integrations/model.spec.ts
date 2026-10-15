import { describe, expect, it } from 'vitest';
import type { IntegrationSystemConfigV1 } from '@nora/contracts';
import { integrationSections, registryConfig, systemSalesState } from './model';
describe('Integration centre presentation semantics', () => {
  it('provides the nine independent sections without duplicate titles', () => {
    expect(integrationSections).toHaveLength(9);
    expect(new Set(integrationSections.map((row) => row.title)).size).toBe(9);
  });
  it('distinguishes education and other purposes from missing travel-sale data', () => {
    expect(
      systemSalesState({
        businessDomain: 'EDUCATION',
      } as IntegrationSystemConfigV1),
    ).toBe('نامرتبط');
    expect(
      systemSalesState({
        businessDomain: 'TRAVEL',
      } as IntegrationSystemConfigV1),
    ).toBe('داده موجود نیست');
  });
  it('excludes server readiness, counts and actor metadata from configuration writes', () => {
    const config = registryConfig({
      schemaVersion: 1,
      brands: [],
      systems: [],
      capabilities: [],
      canManage: true,
      counts: null,
      lastChange: null,
    } as never);
    expect(Object.keys(config)).toEqual([
      'schemaVersion',
      'brands',
      'systems',
      'capabilities',
    ]);
  });
});
