import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260829133000_master_data_suppliers/migration.sql',
  ),
  'utf8',
);
const seed = readFileSync(resolve(process.cwd(), 'prisma/seed.ts'), 'utf8');

describe('MASTER-003E-SUPPLIERS migration', () => {
  it('is additive and creates normalized supplier service relations', () => {
    expect(sql).toContain('CREATE TABLE "master_suppliers"');
    expect(sql).toContain('CREATE TABLE "master_travel_services"');
    expect(sql).toContain('CREATE TABLE "master_supplier_services"');
    expect(sql).toContain('CREATE TABLE "master_broker_services"');
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
  });

  it('enforces one supplier profile per organization and restrictive FKs', () => {
    expect(sql).toContain('master_suppliers_organizationId_key');
    expect(sql).toContain('master_supplier_services_pkey');
    expect(sql).toContain('master_broker_services_pkey');
    expect(sql.match(/ON DELETE RESTRICT/g)?.length).toBeGreaterThanOrEqual(10);
  });

  it('stores protected contacts without plaintext columns', () => {
    expect(sql).toContain('master_organization_contacts_phone_crypto_check');
    expect(sql).toContain('master_organization_contacts_email_crypto_check');
    expect(sql).toContain('"phoneEncrypted" TEXT');
    expect(sql).toContain('"emailEncrypted" TEXT');
    expect(sql).not.toMatch(/"(?:phone|email)"\s+VARCHAR/i);
  });

  it('does not seed supplier, contact, provider or contract data', () => {
    expect(seed).not.toContain('masterSupplier.create');
    expect(seed).not.toContain('masterOrganizationContact.create');
    expect(seed).not.toContain('masterTravelService.create');
  });
});
