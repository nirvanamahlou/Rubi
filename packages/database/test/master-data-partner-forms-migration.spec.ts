import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
const sql = readFileSync(resolve(process.cwd(), 'prisma/migrations/20260831090000_master_data_partner_forms/migration.sql'), 'utf8');
describe('partner form additive migration', () => {
  it('preserves existing rows and adds nullable identity metadata', () => {
    expect(sql).not.toMatch(/\b(DROP|TRUNCATE|DELETE FROM|UPDATE\s+")/i);
    expect(sql).toContain("IN ('NATURAL', 'LEGAL')");
    expect(sql).toContain('ADD COLUMN "englishName" VARCHAR(160)');
  });
  it('enforces primary contacts belonging to the same organization without cascading identity changes', () => {
    expect(sql.match(/FOREIGN KEY \("primaryContactId", "organizationId"\)/g)).toHaveLength(2);
    expect(sql.match(/ON DELETE RESTRICT ON UPDATE RESTRICT/g)).toHaveLength(2);
    expect(sql).toContain('master_organization_contacts_id_organizationId_key');
  });
});
