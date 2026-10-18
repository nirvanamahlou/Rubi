import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20261018110000_currency_toman_per_unit/migration.sql',
  ),
  'utf8',
);
const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);

describe('per-unit toman reference migration', () => {
  it('targets the actual mapped currency table, not the Prisma model name', () => {
    const model = schema.match(/model MasterCurrency \{([\s\S]*?)\n\}/)?.[1];
    expect(model).toContain('@@map("master_currencies")');
    expect(sql).toContain(
      'ALTER TABLE "master_currencies" ADD COLUMN "tomanPerUnit" DECIMAL(24,10);',
    );
    expect(sql).not.toContain('ALTER TABLE "MasterCurrency"');
  });
  it('adds a nullable positive finite decimal atomically without modifying legacy rates', () => {
    expect(sql).toContain('BEGIN;');
    expect(sql.trimEnd()).toMatch(/COMMIT;$/);
    expect(sql).toContain('"tomanPerUnit" IS NULL');
    expect(sql).toContain('"tomanPerUnit" > 0');
    expect(sql).toContain('"tomanPerUnit" < \'Infinity\'::numeric');
    expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE\s+FROM|UPDATE\s+")/i);
    expect(sql).not.toContain('SET "unitsPerUsd"');
    expect(sql).not.toContain('NOT NULL');
  });
});
