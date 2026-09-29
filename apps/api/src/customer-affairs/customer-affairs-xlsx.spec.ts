import { describe, expect, it } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { customerAffairsXlsx } from './customer-affairs-xlsx';

describe('Customer Affairs Excel export', () => {
  it('produces a readable RTL workbook and inert cells', () => {
    const files = unzipSync(
      customerAffairsXlsx('Tickets', [
        ['موضوع', 'وضعیت'],
        ['=HYPERLINK("https://bad.example")', '<script>'],
      ]),
    );
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain('&lt;script&gt;');
    expect(sheet).toContain('&apos;=HYPERLINK');
    expect(files['xl/workbook.xml']).toBeDefined();
  });
});
