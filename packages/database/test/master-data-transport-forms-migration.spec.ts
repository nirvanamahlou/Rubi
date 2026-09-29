import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260831120000_master_data_transport_forms/migration.sql',
  ),
  'utf8',
);
describe('transport forms additive migration', () => {
  it('keeps all existing values and prevents active review records', () => {
    expect(sql).not.toMatch(/(?:^|\n)\s*(?:DROP|DELETE|TRUNCATE|UPDATE)\b/);
    expect(
      sql.match(/ADD COLUMN "isUnderReview" BOOLEAN NOT NULL DEFAULT false/g),
    ).toHaveLength(7);
    expect(
      sql.match(/CHECK \(NOT "isUnderReview" OR NOT "isActive"\)/g),
    ).toHaveLength(7);
  });
  it('stores unique train-facility links with restrictive foreign keys and reverse lookup index', () => {
    expect(sql).toContain('PRIMARY KEY ("trainTypeId", "facilityId")');
    expect(sql.match(/ON DELETE RESTRICT/g)).toHaveLength(2);
    expect(sql).toContain(
      'CREATE INDEX "master_train_type_facilities_facilityId_idx"',
    );
  });
});
