import { describe, expect, it } from 'vitest';

import {
  createCustomerXlsx,
  customerImportHeaders,
  unzipWorkbook,
  validateCustomerWorkbookXml,
} from './customer-xlsx';

describe('Customer XLSX', () => {
  it.each([
    'expanded-size',
    'entry-count',
    'traversal',
    'encrypted',
    'external-link',
  ])('rejects unsafe archive metadata: %s', async (attack) => {
    const bytes = createCustomerXlsx([customerImportHeaders]);
    const view = new DataView(bytes.buffer);
    const end = bytes.length - 22;
    const central = view.getUint32(end + 16, true);
    if (attack === 'expanded-size')
      view.setUint32(central + 24, 21 * 1024 * 1024, true);
    if (attack === 'entry-count') view.setUint16(end + 10, 101, true);
    if (attack === 'encrypted') view.setUint16(central + 8, 1, true);
    if (attack === 'traversal')
      bytes.set(new TextEncoder().encode('../'), central + 46);
    if (attack === 'external-link')
      bytes.set(new TextEncoder().encode('externalLinks'), central + 46);
    await expect(unzipWorkbook(bytes.buffer)).rejects.toThrow();
  });
  it('verifies a generated archive and detects corrupt ZIP content', async () => {
    const bytes = createCustomerXlsx([customerImportHeaders]);
    expect(
      (await unzipWorkbook(bytes.buffer)).has('xl/worksheets/sheet1.xml'),
    ).toBe(true);
    bytes[60] = bytes[60]! ^ 1;
    await expect(unzipWorkbook(bytes.buffer)).rejects.toThrow();
    await expect(
      unzipWorkbook(new ArrayBuffer(6 * 1024 * 1024)),
    ).rejects.toThrow();
  });
  it.each([
    '\u0000',
    '\u0008',
    '\u001f',
    '\u007f',
    '<f>1+1</f>',
    '<x:f>1+1</x:f>',
    '<ddeLink/>',
    '<!DOCTYPE x>',
    '<!ENTITY x>',
    'macroEnabled',
    'vbaProject',
    '<Relationship TargetMode="External"/>',
  ])('rejects unsafe XML %j', (text) => {
    expect(() => validateCustomerWorkbookXml(text)).toThrow();
  });
  it('allows tab/CR/LF and writes formulas only as escaped inline text', () => {
    expect(() => validateCustomerWorkbookXml('<t>\t\r\n</t>')).not.toThrow();
    const xml = new TextDecoder().decode(
      createCustomerXlsx([['=1+1', '<f>bad</f>']]),
    );
    expect(xml).not.toContain('<f>');
    expect(xml).toContain('t="inlineStr"');
  });
  it('creates a real ZIP-based Office Open XML workbook', () => {
    const bytes = createCustomerXlsx([customerImportHeaders]);
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(0x04034b50);
    expect(new TextDecoder().decode(bytes)).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    );
    expect(new TextDecoder().decode(bytes)).toContain('نام مشتری*');
  });
});
