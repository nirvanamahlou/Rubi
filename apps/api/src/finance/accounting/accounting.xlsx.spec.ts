import { describe, it, expect } from 'vitest';
import { unzipSync, strFromU8 } from 'fflate';
import { accountingXlsx } from './accounting.xlsx';
describe('accounting Excel export', () => {
  it('preserves exact money and treats formula-like user text as data', () => {
    const files = unzipSync(
      accountingXlsx(
        'Trial balance',
        ['Code', 'Title', 'Balance'],
        [
          ['001', '=HYPERLINK("bad")', '9007199254740993.123456789012345678'],
          ['002', '<test>&', '-0.01'],
        ],
      ),
    );
    const sheet = strFromU8(files['xl/worksheets/sheet1.xml']!);
    expect(sheet).toContain('9007199254740993.123456789012345678');
    expect(sheet).toContain('=HYPERLINK(&quot;bad&quot;)');
    expect(sheet).not.toContain('<f>');
    expect(sheet).toContain('&lt;test&gt;&amp;');
    expect(sheet).toContain('rightToLeft="1"');
    expect(sheet).toContain('A1:C4');
    expect(files['[Content_Types].xml']).toBeDefined();
    expect(files['xl/_rels/workbook.xml.rels']).toBeDefined();
  });
});
