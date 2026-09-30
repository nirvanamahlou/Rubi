import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function source(fileName: string) {
  return readFileSync(
    resolve(process.cwd(), 'src/modules/master-data/components', fileName),
    'utf8',
  );
}

const recordRenderers = [
  'master-data-live-workspace.tsx',
  'master-data-geography-workspace.tsx',
  'master-data-finance-workspace.tsx',
  'master-data-accommodation-workspace.tsx',
  'master-data-insurance-workspace.tsx',
  'master-data-suppliers-workspace.tsx',
  'master-data-transportation-workspace.tsx',
  'master-data-travel-services-workspace.tsx',
  'master-data-sales-references-workspace.tsx',
  'master-data-bank-profile.tsx',
  'master-data-airline-baggage-editor.tsx',
] as const;

describe('Master Data record presentation', () => {
  it('uses the authenticated logo cell on every persisted-record renderer', () => {
    for (const fileName of recordRenderers)
      expect(source(fileName), fileName).toContain('<MasterDataLogoCell');
    const cell = source('master-data-logo-cell.tsx');
    expect(cell).toContain('<MasterDataLogoImage');
    expect(cell).toContain('بدون لوگو:');
    expect(cell).not.toMatch(/https?:\/\//);
  });

  it('places logos beside codes in nested and card-based record lists', () => {
    const geography = source('master-data-geography-workspace.tsx');
    for (const [start, record] of [
      ['cities.map((city)', 'city'],
      ['airports.map((airport)', 'airport'],
      ['terminals.map(', 'terminal'],
    ] as const) {
      const block = geography.slice(geography.indexOf(start));
      const codeIndex = block.indexOf(`${record}.code`);
      const logoIndex = block.search(
        new RegExp(`record=\\{\\s*${record}\\s*\\}`),
      );
      expect(codeIndex, `${record} code`).toBeGreaterThanOrEqual(0);
      expect(logoIndex, `${record} logo`).toBeGreaterThan(codeIndex);
      expect(logoIndex - codeIndex, `${record} adjacent logo`).toBeLessThan(
        500,
      );
    }

    const suppliers = source('master-data-suppliers-workspace.tsx');
    const collaboration = suppliers.slice(
      suppliers.indexOf('laneRecords.map((record)'),
      suppliers.indexOf('const content'),
    );
    expect(collaboration.indexOf('{record.code}')).toBeLessThan(
      collaboration.indexOf('record={record}'),
    );
    expect(collaboration).not.toContain('<MasterDataLogoImage record={record}');

    const finance = source('master-data-finance-workspace.tsx');
    const payments = finance.slice(
      finance.indexOf("tab === 'payments' ?"),
      finance.indexOf("tab === 'payments' ?") + 3000,
    );
    expect(payments.indexOf('{record.code}')).toBeLessThan(
      payments.indexOf('record={record}'),
    );

    const baggage = source('master-data-airline-baggage-editor.tsx');
    expect(baggage.indexOf('{rule.code}')).toBeLessThan(
      baggage.indexOf('record={rule}'),
    );
  });

  it('removes direct power actions while preserving status in edit forms', () => {
    for (const fileName of recordRenderers) {
      const renderer = source(fileName);
      expect(renderer, fileName).not.toContain('<MasterDataPowerButton');
      expect(renderer, fileName).not.toContain('<Power ');
    }
    expect(source('../model/form-fields.ts')).toContain(
      "key: 'transportStatus'",
    );
    expect(source('../model/catalog.ts')).toContain(
      "key: 'collaborationStatus'",
    );
  });

  it('uses exact global city summary and removes requested placeholder KPIs', () => {
    const geography = source('master-data-geography-workspace.tsx');
    expect(geography).toContain("masterDataApi.listSummary('cities'");
    expect(geography).toContain("label: 'کل شهرهای مرتبط'");
    expect(geography).not.toContain("label: 'ناقص یا نیازمند بررسی'");
    const suppliers = source('master-data-suppliers-workspace.tsx');
    expect(suppliers).not.toContain("label: 'طرف قرارداد'");
  });

  it('keeps the countries table aligned without exposing record version', () => {
    const geography = source('master-data-geography-workspace.tsx');
    const countryColumns = geography.slice(
      geography.indexOf(
        "if (resource === 'countries')",
        geography.indexOf('function geographyColumns'),
      ),
      geography.indexOf(
        "if (resource === 'regions')",
        geography.indexOf('function geographyColumns'),
      ),
    );
    expect(countryColumns).toMatch(
      /'کد ISO-2',[\s\S]*'لوگو',[\s\S]*'نام فارسی',[\s\S]*'نام انگلیسی',[\s\S]*'ترتیب',[\s\S]*'وابستگی‌ها',[\s\S]*'آخرین تغییر',[\s\S]*'وضعیت',[\s\S]*'عملیات'/,
    );
    expect(countryColumns).not.toContain('نسخه');

    const cellsStart = geography.indexOf('function recordCells');
    const countryCells = geography.slice(
      geography.indexOf("if (resource === 'countries')", cellsStart),
      geography.indexOf("if (resource === 'regions')", cellsStart),
    );
    expect(countryCells).not.toContain('record.version');
    expect(countryCells).toContain('statusBadge(record)');

    const nonCountryGeography = geography.slice(
      geography.indexOf("if (resource === 'regions')", cellsStart),
      geography.indexOf("if (resource === 'airports')", cellsStart),
    );
    expect(nonCountryGeography.match(/record\.version/g)).toHaveLength(2);
    expect(geography.match(/'نسخه'/g)).toHaveLength(2);
  });
});
