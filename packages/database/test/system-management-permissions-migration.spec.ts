import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260921144500_system_management_permissions/migration.sql',
  ),
  'utf8',
);

describe('system management permission migration', () => {
  it('publishes the read and manage permissions required by the settings API', () => {
    expect(sql).toContain("'system.settings.read'");
    expect(sql).toContain("'system.settings.manage'");
    expect(sql).toContain("'system.audit.read'");
    expect(sql).toContain("'system.health.read'");
  });

  it('grants system permissions idempotently to the administrator role', () => {
    expect(sql).toContain("role.\"code\" = 'administrator'");
    expect(sql).toContain("permission.\"code\" LIKE 'system.%'");
    expect(sql).toContain('ON CONFLICT ("roleId", "permissionId") DO NOTHING');
  });

  it('does not remove existing IAM grants', () => {
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
  });
});
