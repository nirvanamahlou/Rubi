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
const connections = readFileSync(
  new URL('./agency-connections-panel.tsx', import.meta.url),
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

  it('loads operational and address data through public APIs without inventing Finance exposure', () => {
    expect(source).not.toContain('BLOCKED_FOR_MIGRATION');
    expect(client).toContain('workspace(organizationId');
    expect(connections).toContain('agencyClient.workspace');
    expect(connections).toContain('createOrganizationAddress');
    expect(connections).toContain('upsertCreditPolicy');
    expect(connections).toContain('createAgreedRate');
    expect(connections).toContain(
      'درگاه Finance هنوز Snapshot منتشر نکرده است',
    );
    expect(source).toContain('phoneMasked');
    expect(source).toContain('emailMasked');
  });
});
