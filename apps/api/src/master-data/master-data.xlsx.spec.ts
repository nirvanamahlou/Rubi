import type { MasterDataRecord } from '@rubi/contracts';
import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';

import { buildMasterDataXlsx } from './master-data.xlsx';

const record: MasterDataRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  resource: 'countries',
  code: 'IR',
  name: '=HYPERLINK("https://invalid.example")',
  status: 'active',
  attributes: { englishName: 'Iran' },
  version: 1,
  createdAt: '2026-08-26T00:00:00.000Z',
  updatedAt: '2026-08-26T00:00:00.000Z',
};

describe('buildMasterDataXlsx', () => {
  it('creates a valid RTL workbook with inline strings and no formulas', () => {
    const files = unzipSync(
      buildMasterDataXlsx({
        resource: 'countries',
        columns: ['code', 'name', 'englishName', 'status', 'updatedAt'],
        records: [record],
        locale: 'fa-IR',
        timezone: 'Asia/Tehran',
      }),
    );
    expect(Object.keys(files)).toEqual(
      expect.arrayContaining([
        '[Content_Types].xml',
        'xl/workbook.xml',
        'xl/worksheets/sheet1.xml',
        'xl/styles.xml',
      ]),
    );
    const worksheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(worksheet).toContain('rightToLeft="1"');
    expect(worksheet).toContain('کد سیستمی');
    expect(worksheet).toContain('Iran');
    expect(worksheet).toContain('t="inlineStr"');
    expect(worksheet).not.toContain('<f>');
  });
});
