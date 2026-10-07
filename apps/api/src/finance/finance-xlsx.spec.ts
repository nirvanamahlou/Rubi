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
  it('exports English headings with original record content and exact amounts', () => {
    const files = unzipSync(
      buildFinanceXlsx(
        { ...snapshot, rows: [['ورودی اختصاصی', '10.25']] },
        'en',
      ),
    );
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('rightToLeft="0"');
    expect(sheet).toContain('Title');
    expect(sheet).toContain('Amount');
    expect(sheet).not.toContain('>عنوان<');
    expect(sheet).toContain('ورودی اختصاصی');
    expect(sheet).toContain('<v>10.25</v>');
  });
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
  it('prints separate currency totals and signature spaces for a recorded receipt', () => {
    const files = unzipSync(
      buildFinanceXlsx({
        ...snapshot,
        scope: 'RECEIPT',
        columns: Array.from({ length: 14 }, () => ({
          label: 'فیلد',
          type: 'TEXT' as const,
        })),
        rows: [],
        totals: [{ currencyCode: 'IRR', amount: '100.125' }],
      }),
    );
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('جمع در IRR');
    expect(sheet).toContain('<v>100.125</v>');
    expect(sheet).toContain('امضای دریافت‌کننده');
    expect(sheet).toContain('امضای پرداخت‌کننده');
    expect(sheet).toContain('dimension ref="A1:N10"');
    expect(strFromU8(files['xl/workbook.xml']!)).toContain('_xlnm.Print_Area');
  });
});
