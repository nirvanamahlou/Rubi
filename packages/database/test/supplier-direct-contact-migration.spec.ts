import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260916121500_supplier_direct_contact/migration.sql',
  ),
  'utf8',
);

describe('supplier direct contact additive migration', () => {
  it('adds address and protected phone storage without destructive statements', () => {
    expect(sql).toContain('ALTER TABLE "master_suppliers"');
    for (const column of [
      'address',
      'primaryPhoneEncrypted',
      'primaryPhoneMasked',
      'primaryPhoneFingerprint',
    ])
      expect(sql).toContain(`ADD COLUMN "${column}"`);
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE)\b/i);
  });
});
