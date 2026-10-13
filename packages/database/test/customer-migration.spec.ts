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
const hardeningMigration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260824113000_customer_contact_encryption_hardening/migration.sql',
  ),
  'utf8',
);
const nationalIdMigration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260829170000_customer_national_id/migration.sql',
  ),
  'utf8',
);
const seed = readFileSync(resolve(process.cwd(), 'prisma/seed.ts'), 'utf8');

const nationalIdKeyMigration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260831120000_customer_national_id_key_required/migration.sql',
  ),
  'utf8',
);

describe('national-ID key version hardening', () => {
  it('closes the SQL UNKNOWN loophole without rewriting historical migrations', () => {
    expect(nationalIdKeyMigration).toContain(
      'customers_national_id_key_required_check',
    );
    expect(nationalIdKeyMigration).toContain(
      '"nationalIdEncrypted" IS NULL OR "nationalIdKeyVersion" IS NOT NULL',
    );
    expect(nationalIdKeyMigration).not.toMatch(
      /\b(?:DROP|TRUNCATE|DELETE FROM)\b/i,
    );
  });
});

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
    expect(seed).toContain('protectSyntheticContact');
    expect(seed).toContain("createCipheriv('aes-256-gcm'");
    expect(seed).toContain("createHmac('sha256'");
    expect(seed).not.toContain("['+98', '912'");
  });
  it('adds constrained encryption fields without rewriting the pushed migration', () => {
    for (const column of [
      'encryptedValue',
      'encryptionIv',
      'encryptionAuthTag',
      'encryptionKeyVersion',
      'valueFingerprint',
    ])
      expect(hardeningMigration).toContain(`ADD COLUMN "${column}"`);
    expect(hardeningMigration).toContain(
      'customer_contacts_encryption_bundle_check',
    );
    expect(hardeningMigration).toContain('char_length("encryptionIv") = 16');
    expect(hardeningMigration).toContain(
      'char_length("encryptionAuthTag") = 24',
    );
    expect(hardeningMigration).toContain('"encryptionKeyVersion" > 0');
    expect(hardeningMigration).toContain("'^[0-9a-f]{64}" + '$' + "'");
    expect(hardeningMigration).toContain(
      'customer_contacts_type_valueFingerprint_customerId_idx',
    );
    expect(hardeningMigration).not.toMatch(
      /\b(?:DROP|TRUNCATE|DELETE FROM)\b/i,
    );
  });

  it('stores national IDs only as encrypted, fingerprinted and masked values', () => {
    for (const column of [
      'nationalIdEncrypted',
      'nationalIdIv',
      'nationalIdAuthTag',
      'nationalIdKeyVersion',
      'nationalIdFingerprint',
      'nationalIdMasked',
    ])
      expect(nationalIdMigration).toContain(`ADD COLUMN "${column}"`);
    expect(nationalIdMigration).toContain(
      'customers_nationalIdFingerprint_key',
    );
    expect(nationalIdMigration).toContain(
      'customers_national_id_complete_check',
    );
    expect(nationalIdMigration).not.toMatch(
      /ADD COLUMN "nationalId"|\b(?:DROP|TRUNCATE|DELETE FROM)\b/i,
    );
  });
});
