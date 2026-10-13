import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  join(
    process.cwd(),
    'prisma/migrations/20260829150000_master_data_accommodation/migration.sql',
  ),
  'utf8',
);
const schema = readFileSync(
  join(process.cwd(), 'prisma/schema.prisma'),
  'utf8',
);
const seed = readFileSync(join(process.cwd(), 'prisma/seed.ts'), 'utf8');

describe('MASTER-003F accommodation migration', () => {
  it('is additive and keeps existing hotel data intact', () => {
    expect(migration).not.toMatch(/(?:^|\n)\s*(?:DROP|TRUNCATE|DELETE)\b/im);
    expect(migration).toContain('ALTER TABLE "master_hotels"');
    expect(migration).toContain('ON CONFLICT DO NOTHING');
  });

  it('models chains, normalized catalogs and composite membership', () => {
    for (const table of [
      'master_hotel_chains',
      'master_hotel_meal_services',
      'master_hotel_room_types',
      'master_composite_hotels',
      'master_composite_hotel_members',
    ])
      expect(migration).toContain(`CREATE TABLE "${table}"`);
    expect(schema).toContain('model MasterHotelChain');
    expect(schema).toContain('model MasterCompositeHotel');
  });

  it('enforces coordinates, time, priority and restrictive references', () => {
    expect(migration).toContain('master_hotels_coordinate_pair_check');
    expect(migration).toContain('master_hotels_latitude_check');
    expect(migration).toContain('master_hotels_longitude_check');
    expect(migration).toContain('master_hotels_check_in_time_check');
    expect(migration).toContain(
      'master_composite_hotel_members_priority_check',
    );
    expect(migration).toMatch(/ON DELETE RESTRICT/g);
  });

  it('does not seed hotels, chains, contracts or operational inventory', () => {
    expect(seed).not.toMatch(/masterHotel(?:Chain)?\.(?:create|upsert)/);
    expect(seed).not.toMatch(/masterCompositeHotel\.(?:create|upsert)/);
    expect(seed).not.toMatch(/hotel inventory|contract reference/i);
  });
});
