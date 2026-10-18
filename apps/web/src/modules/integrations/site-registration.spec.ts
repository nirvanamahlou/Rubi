import { describe, expect, it } from 'vitest';
import type { IntegrationRegistryV1 } from '@nora/contracts';
import {
  newBrandValue,
  siteDraft,
  siteRegistration,
} from './site-registration';

const ids = {
  system: '11111111-1111-4111-8111-111111111111',
  brand: '22222222-2222-4222-8222-222222222222',
};
const empty = {
  schemaVersion: 1,
  version: 0,
  brands: [],
  systems: [],
  capabilities: [],
  initialized: false,
} as unknown as IntegrationRegistryV1;

describe('new site registration', () => {
  it('can register the first site and brand without seed or a user-entered technical code', () => {
    const draft = {
      ...siteDraft(empty),
      name: 'سایت من',
      brandName: 'برند من',
      websiteUrl: 'https://site.example.com',
    };
    expect(draft.brandId).toBe(newBrandValue);
    const result = siteRegistration(empty, draft, ids);
    expect(result.expectedVersion).toBe(0);
    expect(result.systems[0]).toMatchObject({
      id: ids.system,
      code: `site-${ids.system}`,
      brandId: ids.brand,
      name: 'سایت من',
      setup: {
        websiteUrl: draft.websiteUrl,
        protocol: 'UNDECIDED',
        environment: 'SANDBOX',
      },
    });
    expect(result.brands[0]).toMatchObject({
      id: ids.brand,
      code: `brand-${ids.brand}`,
      name: 'برند من',
    });
    expect(empty.systems).toHaveLength(0);
    expect(siteRegistration(empty, draft, ids)).toEqual(result);
  });
  it('adds another site to an existing brand while preserving all existing identities', () => {
    const initial = siteRegistration(
      empty,
      { ...siteDraft(empty), name: 'اول', brandName: 'برند' },
      ids,
    );
    const registry = { ...empty, ...initial, version: 7 };
    const result = siteRegistration(
      registry,
      { ...siteDraft(registry), name: 'دوم' },
      { ...ids, system: '33333333-3333-4333-8333-333333333333' },
    );
    expect(result.brands).toEqual(initial.brands);
    expect(result.systems[0]).toEqual(initial.systems[0]);
    expect(result.systems).toHaveLength(2);
    expect(result.expectedVersion).toBe(7);
  });
  it('prefills and updates setup without changing a disabled system identity or lifecycle', () => {
    const initial = siteRegistration(
      empty,
      {
        ...siteDraft(empty),
        name: 'اول',
        brandName: 'برند',
        apiBaseUrl: 'https://api.example.com/v1',
      },
      ids,
    );
    const system = { ...initial.systems[0]!, lifecycle: 'DISABLED' as const };
    const registry = { ...empty, ...initial, systems: [system], version: 2 };
    const draft = siteDraft(registry, system);
    expect(draft.apiBaseUrl).toBe('https://api.example.com/v1');
    const result = siteRegistration(
      registry,
      { ...draft, apiBaseUrl: '', businessDomain: 'EDUCATION' },
      ids,
      system,
    );
    expect(result.systems).toHaveLength(1);
    expect(result.systems[0]).toMatchObject({
      id: system.id,
      code: system.code,
      lifecycle: 'DISABLED',
      businessDomain: 'EDUCATION',
    });
    expect(result.systems[0]!.setup).not.toHaveProperty('apiBaseUrl');
  });
});
