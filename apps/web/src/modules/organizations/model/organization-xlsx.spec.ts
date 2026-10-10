import { describe, expect, it } from 'vitest';
import {
  createOrganizationXlsx,
  hasRequiredOrganizationColumns,
  isAllowedOrganizationWorkbookRelationship,
  normalizeOrganizationHeader,
  unzipWorkbook,
  validateOrganizationWorkbookXml,
} from './organization-xlsx';
import { organizationHeaders } from './organization-import';
describe('organization XLSX container', () => {
  it('normalizes Persian, Arabic and English headers regardless of spacing', () => {
    expect(normalizeOrganizationHeader('  نام‌ حقوقي آژانس  ')).toBe(
      normalizeOrganizationHeader('نام حقوقی آژانس'),
    );
    expect(normalizeOrganizationHeader('Office_Phone')).toBe('officephone');
  });
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
  it('accepts compact columns without optional email and license columns', () => {
    expect(
      hasRequiredOrganizationColumns([
        'legalName',
        'chiefExecutiveName',
        'officePhone',
        'chiefExecutiveMobile',
        'addressLine',
      ]),
    ).toBe(true);
  });
  it.each([
    '<!DOCTYPE x>',
    '<x:f>SUM(A1)</x:f>',
    '<Relationship TargetMode="External"/>',
  ])('rejects active workbook content %s', (xml) => {
    expect(() => validateOrganizationWorkbookXml(xml)).toThrow();
  });
  it('allows only strict mailto hyperlinks among external relationships', () => {
    const type =
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink';
    const safeRelationship = `<Relationship Id="rId1" Type="${type}" Target="mailto:golpham@gmail.com" TargetMode="External"/>`;

    expect(() => validateOrganizationWorkbookXml(safeRelationship)).not.toThrow();
    expect(
      isAllowedOrganizationWorkbookRelationship(
        type,
        'mailto:golpham@gmail.com',
        'External',
      ),
    ).toBe(true);
    expect(
      isAllowedOrganizationWorkbookRelationship(
        type,
        'https://example.com',
        'External',
      ),
    ).toBe(false);
    expect(
      isAllowedOrganizationWorkbookRelationship(
        type,
        'mailto:golpham@gmail.com?subject=unsafe',
        'External',
      ),
    ).toBe(false);
  });
  it('rejects corrupted payloads and truncated archives', async () => {
    const bytes = createOrganizationXlsx([organizationHeaders]);
    bytes[60] = bytes[60]! ^ 1;
    await expect(unzipWorkbook(bytes.buffer)).rejects.toThrow();
    await expect(unzipWorkbook(new ArrayBuffer(21))).rejects.toThrow();
  });
});
