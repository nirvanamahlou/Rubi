import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20260829210000_master_data_insurance/migration.sql',
  ),
  'utf8',
);
const versionMigration = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20260829211000_master_data_insurance_version_constraint/migration.sql',
  ),
  'utf8',
);
const schema = readFileSync(
  join(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);
const seed = readFileSync(join(process.cwd(), 'prisma/seed.ts'), 'utf8');

describe('MASTER-003J-INSURANCE migration', () => {
  it('is additive and protects referenced master data', () => {
    expect(`${migration}\n${versionMigration}`).not.toMatch(
      /(?:^|\n)\s*(?:DROP|TRUNCATE|DELETE)\b/im,
    );
    expect(migration).toContain('ALTER TABLE "master_insurers"');
    expect(migration).toMatch(/ON DELETE RESTRICT/g);
  });

  it('creates normalized plan, coverage and assignment tables', () => {
    for (const table of [
      'master_insurance_plans',
      'master_insurance_coverages',
      'master_insurance_plan_coverages',
    ])
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    expect(schema).toContain('model MasterInsurancePlan');
    expect(schema).toContain('model MasterInsuranceCoverage');
    expect(schema).toContain('model MasterInsurancePlanCoverage');
  });

  it('enforces age, validity, amount and optimistic-version constraints', () => {
    for (const constraint of [
      'master_insurance_plans_age_range_check',
      'master_insurance_plans_validity_check',
      'master_insurance_plans_version_check',
      'master_insurance_coverages_amount_check',
      'master_insurance_coverages_version_check',
    ])
      expect(migration).toContain(constraint);
    expect(versionMigration).toContain('master_insurers_version_check');
  });

  it('does not seed insurers, plans, coverages or policy data', () => {
    expect(seed).not.toMatch(/masterInsurer\.(?:create|upsert)/);
    expect(seed).not.toMatch(
      /masterInsurance(?:Plan|Coverage)\.(?:create|upsert)/,
    );
    expect(seed).not.toMatch(/policy number|insurance policy/i);
  });
});
