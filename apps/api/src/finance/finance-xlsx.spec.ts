import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import type { FinanceExportSnapshotV1 } from '@nora/contracts';
import { buildFinanceXlsx } from './finance-xlsx';

const snapshot: FinanceExportSnapshotV1 = {
  version: 1,
  scope: 'INBOX',
  title: 'مالی',
  generatedAt: '2026-10-04T10:00:00.000Z',
  preparedBy: 'test',
  filterSnapshot: {},
  columns: [
    { label: 'عنوان', type: 'TEXT' },
    { label: 'مبلغ', type: 'DECIMAL' },
  ],
  rows: [
    ['=HYPERLINK("https://invalid", "unsafe")', '12345678901234567890.1234'],
    ['<script>&"', '10.25'],
  ],
  totals: [],
  warnings: [],
};
describe('Finance genuine Excel workbook', () => {
  it('creates an OOXML archive with RTL view and literal text, never formulas', () => {
    const files = unzipSync(buildFinanceXlsx(snapshot));
    expect(Object.keys(files)).toContain('[Content_Types].xml');
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain('=HYPERLINK(&quot;https://invalid&quot;');
    expect(sheet).not.toContain('<f>');
    expect(sheet).toContain('&lt;script&gt;&amp;&quot;');
    expect(sheet).toContain('12345678901234567890.1234');
    expect(sheet).toMatch(/<v>10\.25<\/v>/);
    expect(Object.keys(files).some((key) => key.includes('externalLink'))).toBe(
      false,
    );
  });
  it('keeps zero distinct from missing amounts', () => {
    const files = unzipSync(
      buildFinanceXlsx({
        ...snapshot,
        rows: [
          ['صفر', '0'],
          ['نامشخص', null],
        ],
      }),
    );
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('<v>0</v>');
    expect(sheet.match(/<v>0<\/v>/g)).toHaveLength(1);
  });
});
