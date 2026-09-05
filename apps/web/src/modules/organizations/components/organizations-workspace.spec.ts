import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  new URL('./organizations-workspace.tsx', import.meta.url),
  'utf8',
);
const client = readFileSync(
  new URL('../api/agency-client.ts', import.meta.url),
  'utf8',
);

describe('agency to Master Organization integration', () => {
  it('uses the public Master Data client and the canonical AGENCY role', () => {
    expect(client).toContain("masterDataApi.list('organizations'");
    expect(client).toContain("organizationRole: 'AGENCY'");
    expect(client).toContain("masterDataApi.list('organization-contacts'");
    expect(source).not.toContain('@prisma/client');
    expect(source).not.toContain('MasterDataRepository');
  });

  it('has real request states, filters and pagination', () => {
    for (const state of [
      "'loading'",
      "'empty'",
      "'unauthorized'",
      "'forbidden'",
      "'error'",
    ])
      expect(source).toContain(state);
    expect(source).toContain('setSearch');
    expect(source).toContain('setStatus');
    expect(source).toContain('setPage');
  });

  it('does not invent unavailable operational or address data', () => {
    expect(source).toContain('BLOCKED_FOR_MIGRATION');
    expect(source).toContain('داده ساختگی نمایش داده نمی‌شود');
    expect(source).toContain('phoneMasked');
    expect(source).toContain('emailMasked');
  });
});
