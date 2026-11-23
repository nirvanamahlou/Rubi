import { describe, expect, it } from 'vitest';
import { confirmDeletionSites } from './site-deletion';

describe('removing published products', () => {
  const sites = [{ siteCode: 'nss' }, { siteCode: 'jahan-bastan' }];

  it('requires every published site and accepts no additional ones', () => {
    expect(() => confirmDeletionSites(sites, ['nss'])).toThrow();
    expect(() =>
      confirmDeletionSites(sites, ['nss', 'jahan-bastan', 'ghestiroo']),
    ).toThrow();
    expect(confirmDeletionSites(sites, ['jahan-bastan', 'nss'])).toEqual([
      'jahan-bastan',
      'nss',
    ]);
  });

  it('keeps deletion available for products that were never published', () => {
    expect(confirmDeletionSites([], undefined)).toEqual([]);
  });
});
