import { isValidIranianNationalId, normalizeNationalId } from './customer';
import {
  CUSTOMER_IMPORT_MAX_ROWS,
  type CustomerImportRow,
} from './customer-xlsx';

export interface CustomerImportPreviewRow {
  rowNumber: number;
  row: CustomerImportRow;
  errors: string[];
}

export function previewCustomerImport(
  rows: readonly CustomerImportRow[],
  today = new Date(),
): CustomerImportPreviewRow[] {
  if (rows.length > CUSTOMER_IMPORT_MAX_ROWS)
    throw new Error('حداکثر ۵۰۰۰ ردیف مجاز است.');
  const seen = new Set<string>();
  return rows.map((input, index) => {
    const row = {
      ...input,
      name: input.name.trim(),
      nationalId: normalizeNationalId(input.nationalId),
      phone: normalizeNationalId(input.phone).replace(/[ ()-]/g, ''),
      email: input.email.trim().toLowerCase(),
      birthDate: input.birthDate.trim(),
    };
    const errors: string[] = [];
    const parts = row.name.split(/\s+/).filter(Boolean);
    if (
      parts.length < 2 ||
      row.name.length > 200 ||
      parts.at(-1)!.length > 120 ||
      parts.slice(0, -1).join(' ').length > 120
    )
      errors.push('نام و نام خانوادگی معتبر لازم است.');
    if (!isValidIranianNationalId(row.nationalId))
      errors.push('کد ملی معتبر لازم است.');
    if (seen.has(row.nationalId)) errors.push('شناسه در همین فایل تکراری است.');
    if (row.nationalId) seen.add(row.nationalId);
    if (row.phone && !/^\+?[0-9]{10,15}$/.test(row.phone))
      errors.push('شماره تماس معتبر نیست.');
    if (
      row.email &&
      (row.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
    )
      errors.push('ایمیل معتبر نیست.');
    if (row.birthDate) {
      const date = new Date(`${row.birthDate}T00:00:00.000Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(row.birthDate) ||
        Number.isNaN(date.getTime()) ||
        date.toISOString().slice(0, 10) !== row.birthDate ||
        date > today
      )
        errors.push('تاریخ تولد معتبر میلادی لازم است.');
    }
    return { rowNumber: index + 2, row, errors };
  });
}
