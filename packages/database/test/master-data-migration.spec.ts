import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'prisma/migrations/20260823084001_master_data_foundation/migration.sql',
);
const sql = readFileSync(migrationPath, 'utf8');

describe('MASTER-002 migration', () => {
  it('is additive and creates the expected integrity constraints', () => {
    expect(sql).toContain('CREATE TABLE "master_countries"');
    expect(sql).toContain('CREATE TABLE "master_export_requests"');
    expect(sql).toContain('ON DELETE RESTRICT');
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
  });

  it('stores rates as decimal drafts and timestamps as timestamptz', () => {
    expect(sql).toContain('DECIMAL(24,10)');
    expect(sql).toContain('"isAuthoritative" BOOLEAN NOT NULL DEFAULT false');
    expect(sql).toContain('TIMESTAMPTZ(3)');
  });
});
