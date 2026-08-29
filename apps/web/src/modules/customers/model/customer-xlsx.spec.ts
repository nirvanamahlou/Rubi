import { describe, expect, it } from 'vitest';

import { createCustomerXlsx, customerImportHeaders } from './customer-xlsx';

describe('Customer XLSX', () => {
  it('creates a real ZIP-based Office Open XML workbook', () => {
    const bytes = createCustomerXlsx([customerImportHeaders]);
    expect(new DataView(bytes.buffer).getUint32(0, true)).toBe(0x04034b50);
    expect(new TextDecoder().decode(bytes)).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    );
    expect(new TextDecoder().decode(bytes)).toContain('نام مشتری*');
  });
});
