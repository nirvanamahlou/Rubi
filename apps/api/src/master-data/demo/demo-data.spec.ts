import { MASTER_DATA_RESOURCES } from '@rubi/contracts';
import { describe, expect, it } from 'vitest';
import { DEMO_EXCLUDED, masterDataDemoRecords } from './demo-data';
import { assertLocalDemoTarget } from './local-demo';
import { realisticMasterDataDemoRecords } from './realistic-demo-data';

describe('explicit local Master Data demo fixtures', () => {
  it('offers natural labels without rates, personal contacts or invented external connections', () => {
    const fixtures = realisticMasterDataDemoRecords();
    expect(fixtures.map((row) => row.key)).toEqual(
      masterDataDemoRecords().map((row) => row.key),
    );
    const values = fixtures.map((row) => row.values((key) => key));
    expect(JSON.stringify(values)).not.toMatch(
      /نمونه [12]|Demo (?:Hotel|Supplier|Manufacturer|Bank)|(?:externalProviderReference|fileReferenceId|logoFileReference|primaryPhone|accountNumber|iban|cvv)/i,
    );
    expect(
      fixtures.some((row) => String(row.resource) === 'exchange-rates'),
    ).toBe(false);
    expect(values.find((value) => value.code === 'BB')?.englishName).toBe(
      'Bed & Breakfast',
    );
  });
  it('covers all retained reference catalogs with ordered dependencies and marked synthetic names', () => {
    const fixtures = masterDataDemoRecords();
    expect([...new Set(fixtures.map((row) => row.resource))].sort()).toEqual(
      MASTER_DATA_RESOURCES.filter(
        (resource) => !(DEMO_EXCLUDED as readonly string[]).includes(resource),
      ).sort(),
    );
    const seen = new Set<string>();
    for (const row of fixtures) {
      expect(seen.has(row.key)).toBe(false);
      const values = row.values((key) => {
        expect(seen.has(key), `${row.key} depends on ${key}`).toBe(true);
        return '11111111-1111-4111-8111-111111111111';
      });
      if (row.resource !== 'suppliers')
        expect(values.name ?? values.displayName ?? values.fullName).toContain(
          'آزمایشی',
        );
      expect(JSON.stringify(values)).not.toMatch(
        /(?:externalProviderReference|fileReferenceId|logoFileReference|primaryPhone|accountNumber|iban|cvv)/i,
      );
      seen.add(row.key);
    }
  });

  it.each([
    ['postgresql://localhost:55432/rubi?schema=public', 'development'],
    [
      'postgresql://127.0.0.1:55432/rubi_md_demo_test_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'test',
    ],
  ])('allows only the intended local targets', (url, environment) => {
    expect(() => assertLocalDemoTarget(url, environment)).not.toThrow();
  });

  it.each([
    ['postgresql://remote.example:55432/rubi', 'development'],
    ['postgresql://127.0.0.1:5432/rubi', 'development'],
    ['postgresql://127.0.0.1:55432/postgres', 'development'],
    ['postgresql://127.0.0.1:55432/rubi', 'production'],
    ['postgresql://127.0.0.1:55432/rubi?host=remote.example', 'development'],
    ['postgresql://127.0.0.1:55432/rubi?schema=other', 'development'],
  ])(
    'rejects remote, production, other databases and connection overrides',
    (url, environment) => {
      expect(() => assertLocalDemoTarget(url, environment)).toThrow();
    },
  );
});
