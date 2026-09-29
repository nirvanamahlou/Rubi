import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  resolve(
    __dirname,
    '../prisma/migrations/20260917103000_system_management_foundation/migration.sql',
  ),
  'utf8',
);

describe('SYSTEM-MANAGEMENT-BACKEND-001 migration', () => {
  it('is additive and creates the owned tables', () => {
    for (const table of [
      'system_settings',
      'system_setting_versions',
      'system_numbering_schemes',
      'system_numbering_sequences',
      'system_issued_numbers',
      'system_notification_channels',
      'system_message_templates',
      'system_feature_flags',
      'system_backup_requests',
      'system_admin_operations',
      'system_health_snapshots',
      'system_audit_events',
    ])
      expect(migration).toContain(`CREATE TABLE "${table}"`);

    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
  });

  it('protects versioning, idempotency, and bounded rollout values', () => {
    expect(migration).toContain(
      'system_issued_numbers_schemeId_idempotencyKey_key',
    );
    expect(migration).toContain('system_feature_flags_rollout_check');
    expect(migration).toContain('system_settings_activeVersion_check');
    expect(migration).toContain('system_numbering_padding_check');
  });
});
