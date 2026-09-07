import { describe, expect, it } from 'vitest';
import { createHrXlsx } from './hr-xlsx';

describe('HR employee XLSX export', () => {
  it('creates a real XLSX package containing headers and employee data', () => {
    const bytes = createHrXlsx([
      ['نام و نام خانوادگی', 'کد پرسنلی', 'شعبه'],
      ['نگار بهرامی', 'HR-001', 'نیایش سیر'],
    ]);
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const content = new TextDecoder().decode(bytes);
    expect(content).toContain('نام و نام خانوادگی');
    expect(content).toContain('نگار بهرامی');
    expect(content).toContain('نیایش سیر');
  });
});
