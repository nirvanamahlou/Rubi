import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import {
  procurementPrintHtml,
  renderProcurementXlsx,
} from './procurement.rendering';

const table = {
  title: 'خرید آزمایشی',
  headings: ['شرح', 'مبلغ'],
  rows: [
    ['=HYPERLINK("https://invalid.test")', '12345678901234567890.1234'],
    ['<script>alert(1)</script>', '0'],
  ],
  notes: ['IRR — ارز مستقل'],
};
describe('Procurement export rendering', () => {
  it('creates a valid RTL OpenXML archive preserving decimals and source text without formulas', () => {
    const files = unzipSync(renderProcurementXlsx(table));
    expect(Object.keys(files)).toHaveLength(5);
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain('12345678901234567890.1234');
    expect(sheet).toContain('=HYPERLINK(&quot;');
    expect(sheet).not.toContain('<f>');
    expect(sheet).toContain('&lt;script&gt;');
  });
  it('escapes all report and issuer data in inert Persian print HTML', () => {
    const html = procurementPrintHtml(table, '<img src=x onerror=alert(1)>');
    expect(html).toContain('lang="fa" dir="rtl"');
    expect(html).toContain("default-src 'none'");
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).toContain('تأیید پرداخت نیست');
  });
});
