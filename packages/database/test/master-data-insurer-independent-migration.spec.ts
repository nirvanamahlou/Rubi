import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20261004190000_master_insurer_nullable_organization/migration.sql',
  ),
  'utf8',
);

describe('independent insurer migration', () => {
  it('only relaxes organization nullability and leaves constraints in place', () => {
    expect(migration).toContain('ALTER TABLE "master_insurers"');
    expect(migration).toContain('ALTER COLUMN "organizationId" DROP NOT NULL');
    expect(migration).not.toMatch(/DROP\s+(?:CONSTRAINT|INDEX|COLUMN)/i);
    expect(migration).not.toMatch(/DELETE|TRUNCATE/i);
  });
});
