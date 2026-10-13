import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260831100000_master_data_travel_reference_forms/migration.sql',
  ),
  'utf8',
);
describe('travel reference form additive migration', () => {
  it('preserves old rows, types and defaults without rewriting user data', () => {
    expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+")/i);
    expect(sql).toContain('ADD COLUMN "suggestedCapacityMin" INTEGER');
    expect(sql).toContain("NOT NULL DEFAULT 'DAYS'");
  });
  it('enforces a bounded capacity range and a mutually exclusive validity policy', () => {
    expect(sql).toContain('"suggestedCapacity" IS NOT NULL');
    expect(sql).toContain('"suggestedCapacityMin" <= "suggestedCapacity"');
    expect(sql).toContain("IN ('DAYS', 'PASSPORT_EXPIRY')");
    expect(sql).toContain('"referenceValidityDays" IS NULL');
  });
});
