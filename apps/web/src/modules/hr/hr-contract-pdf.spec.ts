import { describe, expect, it } from 'vitest';
import { buildPdfFromJpeg, contractRecordFromRow } from './hr-contract-pdf';

describe('HR contract PDF export', () => {
  it('maps the active contract dataset to a company-specific record', () => {
    const record = contractRecordFromRow(
      ['شناسه', 'کارمند', 'شماره قرارداد', 'شرکت', 'نوع قرارداد', 'وضعیت'],
      [
        'HR-1',
        'سارا محمدی',
        'HR-CON-1405-012',
        'جهان باستان',
        'عدم افشای اطلاعات (NDA)',
        { label: 'فعال', tone: 'success' },
      ],
    );
    expect(record).toMatchObject({
      employee: 'سارا محمدی',
      number: 'HR-CON-1405-012',
      company: 'جهان باستان',
      type: 'عدم افشای اطلاعات (NDA)',
    });
  });

  it('creates a valid one-page PDF wrapper for a rendered JPEG', () => {
    const pdf = buildPdfFromJpeg(
      new Uint8Array([0xff, 0xd8, 0xff, 0xd9]),
      1240,
      1754,
    );
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Subtype /Image');
    expect(text).toContain('/Count 1');
    expect(text.endsWith('%%EOF')).toBe(true);
  });
});
