import { describe, expect, it } from 'vitest';
import {
  createOrganizationXlsx,
  unzipWorkbook,
  validateOrganizationWorkbookXml,
} from './organization-xlsx';
import { organizationHeaders } from './organization-import';
describe('organization XLSX container', () => {
  it('creates a real workbook with Persian headers and text cells', async () => {
    const bytes = createOrganizationXlsx([
      organizationHeaders,
      ['B2B-001', 'سازمان <آزمون>', 'LEGAL', 'AGENCY'],
    ]);
    const files = await unzipWorkbook(bytes.buffer);
    expect(files.get('xl/workbook.xml')).toContain('Organizations');
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('&lt;آزمون&gt;');
    expect(files.get('xl/worksheets/sheet1.xml')).toContain('inlineStr');
  });
  it.each([
    '<!DOCTYPE x>',
    '<x:f>SUM(A1)</x:f>',
    '<Relationship TargetMode="External"/>',
  ])('rejects active workbook content %s', (xml) => {
    expect(() => validateOrganizationWorkbookXml(xml)).toThrow();
  });
  it('rejects corrupted payloads and truncated archives', async () => {
    const bytes = createOrganizationXlsx([organizationHeaders]);
    bytes[60] = bytes[60]! ^ 1;
    await expect(unzipWorkbook(bytes.buffer)).rejects.toThrow();
    await expect(unzipWorkbook(new ArrayBuffer(21))).rejects.toThrow();
  });
});
