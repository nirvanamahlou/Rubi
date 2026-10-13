import { describe, expect, it } from 'vitest';
import { buildReportPdf } from './section-report-pdf';
import { reportCellText } from './section-reports';
describe('section PDF reports', () => {
  it('creates a page tree and correct byte offsets for multiple pages', () => {
    const bytes = buildReportPdf([
      new Uint8Array([255, 216, 255, 217]),
      new Uint8Array([255, 216, 255, 217]),
    ]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('/Count 2');
    expect(text).toContain('/Kids [3 0 R 6 0 R]');
    const offset = Number(/startxref\n(\d+)/.exec(text)?.[1]);
    expect(new TextDecoder().decode(bytes.slice(offset, offset + 4))).toBe(
      'xref',
    );
    expect(text.endsWith('%%EOF')).toBe(true);
  });
  it('prints attachment labels and goal outcomes without internal file references', () => {
    expect(reportCellText('hr-attachment://secret|file.pdf')).toBe(
      'فایل پیوست',
    );
    expect(
      reportCellText('[{"title":"فروش","weight":4,"achieved":true}]'),
    ).toContain('محقق‌شده');
    expect(reportCellText({ label: 'فعال', tone: 'success' })).toBe('فعال');
  });
});
