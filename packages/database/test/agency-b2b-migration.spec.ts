import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260905150000_agency_b2b_integrations/migration.sql',
  ),
  'utf8',
);

describe('AGENCY-B2B-INTEGRATIONS-001 migration', () => {
  it('is additive and keeps Sales and Finance persistence out of B2B', () => {
    expect(sql).toContain('CREATE TABLE "master_organization_addresses"');
    expect(sql).toContain('CREATE TABLE "b2b_agency_profiles"');
    expect(sql).toContain('CREATE TABLE "b2b_agency_agreements"');
    expect(sql).toContain('CREATE TABLE "b2b_agency_credit_policies"');
    expect(sql).toContain('CREATE TABLE "b2b_agency_agreed_rates"');
    expect(sql).toContain('CREATE TABLE "b2b_audit_events"');
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
    expect(sql).not.toMatch(/REFERENCES\s+"(?:sales|finance)_/i);
  });

  it('enforces organization, branch and city-country relationships', () => {
    expect(sql).toContain(
      'FOREIGN KEY ("cityId", "countryId") REFERENCES "master_cities"("id", "countryId")',
    );
    expect(sql).toContain(
      'FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id")',
    );
    expect(sql).toContain(
      'FOREIGN KEY ("branchId") REFERENCES "branches"("id")',
    );
    expect(sql).toContain('b2b_agency_profiles_organization_branch_key');
    expect(sql).toContain(
      'master_organization_addresses_one_primary_active_key',
    );
  });

  it('protects monetary, percentage, date and optimistic-version invariants', () => {
    expect(sql).toContain('DECIMAL(20,2)');
    expect(sql).toContain('DECIMAL(20,4)');
    expect(sql).toContain('b2b_agency_agreed_rates_percent_check');
    expect(sql).toContain('b2b_agency_agreed_rates_currency_check');
    expect(sql).toContain('b2b_agency_agreements_date_check');
    expect(sql).toContain('b2b_agency_credit_policies_date_check');
    expect(sql).toContain('b2b_agency_agreed_rates_date_check');
    expect(sql.match(/version_check/g)?.length).toBeGreaterThanOrEqual(5);
  });
});
