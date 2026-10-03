import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  resolve(
    process.cwd(),
    'prisma/migrations/20260827090000_master_data_geography/migration.sql',
  ),
  'utf8',
);

describe('MASTER-003B-GEO migration', () => {
  it('is additive and preserves existing city rows', () => {
    expect(sql).toContain('CREATE TABLE "master_regions"');
    expect(sql).toContain('CREATE TABLE "master_airports"');
    expect(sql).toContain('CREATE TABLE "master_terminals"');
    expect(sql).toContain('SET "englishName" = "name"');
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE|DELETE FROM)\b/i);
  });

  it('enforces canonical globally unique ISO, IATA and ICAO codes', () => {
    expect(sql).toContain('master_countries_iso2_format_check');
    expect(sql).toContain('master_airports_iataCode_key');
    expect(sql).toContain('master_airports_icaoCode_key');
    expect(sql).toContain('master_airports_iata_format_check');
    expect(sql).toContain('master_airports_icao_format_check');
  });

  it('enforces structured same-country regions and restrictive foreign keys', () => {
    expect(sql).toContain('master_regions_parent_same_country_fkey');
    expect(sql).toContain('master_cities_region_same_country_fkey');
    expect(sql).toContain('FOREIGN KEY ("regionId", "countryId")');
    expect(sql.match(/ON DELETE RESTRICT/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('enforces timezone format, coordinate ranges and positive versions', () => {
    expect(sql).toContain('master_airports_iana_timezone_format_check');
    expect(sql).toContain('master_airports_latitude_range_check');
    expect(sql).toContain('master_airports_longitude_range_check');
    expect(sql).toContain('CHECK ("latitude" BETWEEN -90 AND 90)');
    expect(sql).toContain('CHECK ("longitude" BETWEEN -180 AND 180)');
    expect(sql.match(/version_positive_check/g)?.length).toBeGreaterThanOrEqual(
      5,
    );
  });

  it('adds filter-oriented geography indexes', () => {
    expect(sql).toContain('master_regions_country_type_active_name_idx');
    expect(sql).toContain('master_cities_regionId_isActive_name_idx');
    expect(sql).toContain('master_airports_cityId_isActive_name_idx');
    expect(sql).toContain('master_terminals_airport_type_active_name_idx');
  });
});
