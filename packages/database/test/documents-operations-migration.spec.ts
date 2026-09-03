import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260903110000_documents_incomplete_status/migration.sql',
  ),
  'utf8',
);
const schema = readFileSync(
  resolve(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);

describe('DOCUMENTS-004 incomplete-status migration', () => {
  it('adds a safe defaulted status and supporting index', () => {
    expect(migration).toContain(
      'ADD COLUMN "is_incomplete" BOOLEAN NOT NULL DEFAULT false',
    );
    expect(migration).toContain(
      'documents_is_incomplete_archive_status_updated_at_idx',
    );
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
    expect(schema).toMatch(/isIncomplete\s+Boolean\s+@default\(false\)/);
  });
});
