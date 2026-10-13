import { describe, expect, it } from 'vitest';
import { previewCustomerImport } from './customer-import-preview';

const row = {
  name: 'مشتری آزمایشی',
  nationalId: '۱۲۳۴۵۶۷۸۹۱',
  phone: '',
  email: '',
  birthDate: '',
};
describe('customer import preview', () => {
  it('normalizes identity and identifies duplicates before any writes', () => {
    const result = previewCustomerImport([
      row,
      { ...row, nationalId: '1234567891' },
    ]);
    expect(result[0]?.row.nationalId).toBe('1234567891');
    expect(result[0]?.errors).toEqual([]);
    expect(result[1]?.errors.join(' ')).toContain('تکراری');
  });
  it('reports invalid fields without silently dropping optional values', () => {
    const result = previewCustomerImport([
      { ...row, email: 'bad', phone: '123', birthDate: '2025-02-29' },
    ]);
    expect(result[0]?.errors).toHaveLength(3);
    expect(result[0]?.row.email).toBe('bad');
    expect(result[0]?.rowNumber).toBe(2);
  });
  it('caps rows and rejects missing identity without generating placeholders', () => {
    expect(() =>
      previewCustomerImport(Array.from({ length: 5001 }, () => row)),
    ).toThrow();
    expect(
      previewCustomerImport([{ ...row, nationalId: '' }])[0]?.errors.join(),
    ).toContain('کد ملی');
  });
});
