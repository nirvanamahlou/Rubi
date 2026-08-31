import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260826193000_hotel_excel_import_v1/migration.sql',
  ),
  'utf8',
);

describe('MASTER-003 hotel Excel import migration', () => {
  it('is additive and non-destructive', () => {
    expect(sql).toContain('CREATE TABLE "master_hotel_import_sessions"');
    expect(sql).toContain('CREATE TABLE "master_hotel_facilities"');
    expect(sql).toContain('ALTER TABLE "master_hotels"');
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
  });

  it('adds real foreign keys, uniqueness and count constraints', () => {
    expect(sql).toContain('master_hotels_mealServiceId_fkey');
    expect(sql).toContain('master_hotels_defaultRoomTypeId_fkey');
    expect(sql).toContain('master_hotel_facilities_pkey');
    expect(sql).toContain('master_hotel_import_sessions_counts_check');
    expect(sql).toContain(
      'master_hotel_import_sessions_idempotencyKeyHash_key',
    );
  });

  it('indexes active catalogs, hotel relations and expiring sessions', () => {
    expect(sql).toContain('master_meal_services_isActive_name_idx');
    expect(sql).toContain('master_hotels_defaultRoomTypeId_idx');
    expect(sql).toContain(
      'master_hotel_import_sessions_status_previewExpiresAt_idx',
    );
  });
});
