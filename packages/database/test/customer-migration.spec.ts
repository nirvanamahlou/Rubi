import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260824093000_customer_persistence/migration.sql',
  ),
  'utf8',
);
const seed = readFileSync(resolve(process.cwd(), 'prisma/seed.ts'), 'utf8');

describe('CUSTOMER-001 migration and seed', () => {
  it('is additive and creates the complete Customers persistence boundary', () => {
    for (const table of [
      'customers',
      'customer_contacts',
      'customer_addresses',
      'customer_consents',
      'customer_relationships',
      'customer_duplicate_candidates',
      'customer_status_history',
      'customer_audit_events',
    ]) {
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    }
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
    expect(migration).toContain('ON DELETE RESTRICT');
  });

  it('enforces roles, self-reference, score and optimistic-version integrity', () => {
    expect(migration).toContain('customers_at_least_one_role_check');
    expect(migration).toContain('customer_relationships_no_self_check');
    expect(migration).toContain('customer_duplicate_candidates_no_self_check');
    expect(migration).toContain('customer_duplicate_candidates_score_check');
    expect(migration).toContain('version_positive_check');
  });

  it('stores no raw contact value and uses idempotent synthetic fixtures', () => {
    expect(migration).toContain('"maskedValue" VARCHAR(160) NOT NULL');
    expect(migration).toContain('"valueHash" CHAR(64) NOT NULL');
    expect(migration).not.toMatch(/"(?:phone|email|value)"\s+VARCHAR/i);
    expect(seed).toContain('transaction.customer.upsert');
    expect(seed).toContain('transaction.customerConsent.upsert');
    expect(seed).toContain('syntheticPhoneHash');
  });
});
