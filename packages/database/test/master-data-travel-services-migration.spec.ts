import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20260829220000_master_data_travel_services/migration.sql',
  ),
  'utf8',
);
const busConnectionsMigration = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20260829221000_master_data_travel_bus_connections/migration.sql',
  ),
  'utf8',
);
const schema = readFileSync(join(process.cwd(), 'prisma/schema.prisma'), 'utf8');
const seed = readFileSync(join(process.cwd(), 'prisma/seed.ts'), 'utf8');

describe('MASTER-003K-TRAVEL-SERVICES migration', () => {
  it('is additive and protects every referenced catalog', () => {
    expect(migration).not.toMatch(/(?:^|\n)\s*(?:DROP|TRUNCATE|DELETE)\b/im);
    expect(migration).toContain('ALTER TABLE "master_leaders"');
    expect(migration.match(/ON DELETE RESTRICT/g)?.length).toBe(5);
  });

  it('creates the normalized travel service catalogs', () => {
    for (const table of [
      'master_tour_types',
      'master_transfer_types',
      'master_cip_services',
      'master_visa_services',
    ])
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    for (const model of [
      'MasterTourType',
      'MasterTransferType',
      'MasterCipService',
      'MasterVisaService',
    ])
      expect(schema).toContain(`model ${model}`);
  });

  it('supports exactly one Organization or Provider and normalized bus facilities', () => {
    expect(busConnectionsMigration).not.toMatch(
      /(?:^|\n)\s*(?:DROP|TRUNCATE|DELETE)\b/im,
    );
    expect(busConnectionsMigration).toContain(
      'master_bus_companies_connection_check',
    );
    expect(busConnectionsMigration).toContain(
      'num_nonnulls("organizationId", "supplierId") = 1',
    );
    expect(busConnectionsMigration).toContain(
      'CREATE TABLE "master_bus_type_facilities"',
    );
    expect(busConnectionsMigration.match(/ON DELETE RESTRICT/g)?.length).toBe(
      3,
    );
    expect(schema).toContain('model MasterBusTypeFacility');
  });

  it('enforces capacity, validity, order and optimistic-version constraints', () => {
    for (const constraint of [
      'master_leaders_version_check',
      'master_tour_types_display_order_check',
      'master_transfer_types_capacity_check',
      'master_cip_services_items_check',
      'master_visa_services_validity_check',
      'master_visa_services_version_check',
    ])
      expect(migration).toContain(constraint);
  });

  it('does not seed leaders, tour, transfer, CIP, visa or passenger data', () => {
    expect(seed).not.toMatch(
      /master(?:Leader|TourType|TransferType|CipService|VisaService)\.(?:create|upsert)/,
    );
    expect(seed).not.toMatch(/passport|passenger document|visa applicant/i);
  });
});
