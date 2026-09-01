import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20260829170000_master_data_transport/migration.sql',
  ),
  'utf8',
);
const schema = readFileSync(
  join(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);

describe('MASTER-003H-TRANSPORT migration', () => {
  it('is additive and keeps referenced records protected', () => {
    expect(migration).not.toMatch(/(?:^|\n)\s*(?:DROP|TRUNCATE|DELETE)\b/im);
    expect(migration).toMatch(/ON DELETE RESTRICT/g);
    expect(migration).toContain('ALTER TABLE "master_airlines"');
  });

  it('creates all eight new transportation resources', () => {
    for (const table of [
      'master_aircraft_types',
      'master_cabin_classes',
      'master_baggage_rules',
      'master_manifest_templates',
      'master_rail_companies',
      'master_train_types',
      'master_bus_companies',
      'master_bus_types',
    ])
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    expect(schema).toContain('model MasterManifestTemplate');
    expect(schema).toContain('model MasterBaggageRule');
  });

  it('enforces baggage and manifest validity constraints in PostgreSQL', () => {
    for (const constraint of [
      'master_baggage_rules_allowance_check',
      'master_baggage_rules_piece_count_check',
      'master_baggage_rules_validity_check',
      'master_manifest_templates_version_number_check',
      'master_manifest_templates_validity_check',
      'master_manifest_templates_active_file_check',
    ])
      expect(migration).toContain(constraint);
  });
});
