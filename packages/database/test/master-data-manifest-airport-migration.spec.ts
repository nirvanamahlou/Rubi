import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260912213000_master_manifest_destination_airport_optional/migration.sql',
  ),
  'utf8',
);

describe('manifest destination and airport create migration', () => {
  it('preserves records while relaxing only the four airport enrichment fields', () => {
    expect(sql).not.toMatch(/(?:^|\n)\s*(?:DELETE|TRUNCATE|DROP TABLE)\b/);
    for (const field of ['icaoCode', 'ianaTimezone', 'latitude', 'longitude'])
      expect(sql).toContain(`ALTER COLUMN "${field}" DROP NOT NULL`);
  });

  it('adds a restrictive destination FK and safe defaults for uploaded XLSX templates', () => {
    expect(sql).toContain('ADD COLUMN "destinationCityId" UUID');
    expect(sql).toContain('REFERENCES "master_cities"("id")');
    expect(sql).toContain('ON DELETE RESTRICT ON UPDATE CASCADE');
    expect(sql).toContain('ALTER COLUMN "fileFormat" SET DEFAULT \'XLSX\'');
    expect(sql).toContain('SET DEFAULT ARRAY[]::TEXT[]');
  });
});
