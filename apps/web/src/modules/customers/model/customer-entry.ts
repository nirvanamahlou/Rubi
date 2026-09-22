import { normalizeNationalId } from './customer';

export function validateCustomerEntryRows(
  rows: readonly {
    label: string;
    firstName: string;
    lastName: string;
    nationalId: string;
  }[],
): string | null {
  const seen = new Map<string, string>();
  for (const row of rows) {
    if (!row.firstName.trim() || !row.lastName.trim())
      return `نام و نام خانوادگی ${row.label} را تکمیل کنید.`;
    const nationalId = normalizeNationalId(row.nationalId);
    const previous = seen.get(nationalId);
    if (previous)
      return `کد ملی ${row.label} با ${previous} یکسان است. برای خود مشتری، گزینه «انتخاب همین مشتری به‌عنوان مسافر» را بزنید.`;
    if (nationalId) seen.set(nationalId, row.label);
  }
  return null;
}
