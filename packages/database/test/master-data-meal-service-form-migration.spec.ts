import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260831130000_master_data_meal_service_forms/migration.sql',
  ),
  'utf8',
);
describe('meal/service lifecycle additive migration', () => {
  it('keeps every existing record active/inactive unchanged by default', () => {
    expect(sql).toContain(
      'ADD COLUMN "isUnderReview" BOOLEAN NOT NULL DEFAULT false',
    );
    expect(sql).not.toMatch(/\b(DROP|DELETE|TRUNCATE|UPDATE)\b/i);
  });
  it('enforces review cannot be active in PostgreSQL', () => {
    expect(sql).toContain('CHECK (NOT "isUnderReview" OR NOT "isActive")');
  });
});
