import { describe, it, expect } from 'vitest';
import { createAccountingXlsx } from './accounting-view-xlsx';

function entries(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const files = new Map<string, string>();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameSize = view.getUint16(offset + 26, true);
    const extra = view.getUint16(offset + 28, true);
    const start = offset + 30 + nameSize + extra;
    files.set(
      new TextDecoder().decode(
        bytes.slice(offset + 30, offset + 30 + nameSize),
      ),
      new TextDecoder().decode(bytes.slice(start, start + size)),
    );
    offset = start + size;
  }
  return files;
}
describe('Accounting displayed-view workbook', () => {
  it('writes a real workbook preserving precise money, leading zeros and Persian text as strings', () => {
    const files = entries(
      createAccountingXlsx([
        ['کد', 'مبلغ'],
        ['00041', '9007199254740993.123456789'],
        ['حساب آزمایشی', '-0.000000001'],
      ]),
    );
    expect(files.has('[Content_Types].xml')).toBe(true);
    const sheet = files.get('xl/worksheets/sheet1.xml')!;
    expect(sheet).toContain('00041');
    expect(sheet).toContain('9007199254740993.123456789');
    expect(sheet).toContain('حساب آزمایشی');
    expect(sheet).toContain('t="inlineStr"');
  });
  it('escapes markup and exports formula-like content as inert text', () => {
    const files = entries(
      createAccountingXlsx([['=HYPERLINK("https://example.test")', '<&>']]),
    );
    const sheet = files.get('xl/worksheets/sheet1.xml')!;
    expect(sheet).not.toContain('<f>');
    expect(sheet).toContain('=HYPERLINK(&quot;https://example.test&quot;)');
    expect(sheet).toContain('&lt;&amp;&gt;');
  });
});
