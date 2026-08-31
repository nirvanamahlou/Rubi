import type { MasterDataRecord } from '@rubi/contracts';

export const tourTypeScopes = [
  { value: 'DOMESTIC', label: 'داخلی' },
  { value: 'INTERNATIONAL', label: 'خارجی' },
  { value: 'BOTH', label: 'داخلی / خارجی' },
] as const;

export function tourTypeFormValues(record?: MasterDataRecord) {
  return {
    name: record?.name ?? '',
    englishName: String(record?.attributes.englishName ?? ''),
    scope: String(record?.attributes.scope ?? ''),
    description: String(record?.attributes.description ?? ''),
    displayOrder: String(record?.attributes.displayOrder ?? 0),
    status: record?.status ?? 'active',
  } satisfies Record<string, string>;
}

export function validateTourTypeForm(input: Record<string, string>) {
  // Allowlist keeps read-only metadata out of every mutation, even on edit.
  const values = Object.fromEntries(
    Object.keys(tourTypeFormValues()).map((key) => [
      key,
      (input[key] ?? '').trim(),
    ]),
  );
  const errors: Record<string, string> = {};
  if (!values.name || values.name.length > 160)
    errors.name = 'عنوان فارسی الزامی و حداکثر ۱۶۰ نویسه است.';
  if ((values.englishName ?? '').length > 160)
    errors.englishName = 'عنوان انگلیسی حداکثر ۱۶۰ نویسه است.';
  if ((values.description ?? '').length > 1000)
    errors.description = 'شرح حداکثر ۱۰۰۰ نویسه است.';
  if (!tourTypeScopes.some((item) => item.value === values.scope))
    errors.scope = 'دامنه را انتخاب کنید.';
  if (!['active', 'inactive'].includes(values.status ?? ''))
    errors.status = 'وضعیت را انتخاب کنید.';
  const order = Number(values.displayOrder || 0);
  if (!Number.isSafeInteger(order) || order < 0 || order > 2147483647)
    errors.displayOrder = 'ترتیب نمایش باید عدد صحیح نامنفی باشد.';
  values.displayOrder = String(order);
  return { values, errors, success: !Object.keys(errors).length };
}

export function tourTypeMutationValues(
  values: Record<string, string>,
  record?: MasterDataRecord,
) {
  const result = validateTourTypeForm(values);
  if (!result.success) throw new Error('فیلدهای نوع تور را اصلاح کنید.');
  // An unchanged status is not a status-management operation.
  if (result.values.status === (record?.status ?? 'active'))
    delete result.values.status;
  return result.values;
}

export function tourTypeUsageLabel(record?: MasterDataRecord) {
  const count = record?.attributes.usageCount;
  return record?.attributes.usageStatus === 'AVAILABLE' &&
    typeof count === 'number' &&
    Number.isSafeInteger(count) &&
    count >= 0
    ? `${count.toLocaleString('fa-IR')} محصول`
    : 'در انتظار اتصال محصولات';
}

export function tourTypeUpdatedLabel(
  record?: MasterDataRecord,
  actorNames: Readonly<Record<string, string>> = {},
) {
  if (!record) return 'پس از ثبت، خودکار درج می‌شود';
  const id = record.attributes.updatedByUserId;
  const actor =
    typeof id === 'string' && id
      ? actorNames[id] || `کاربر با شناسه ${id}`
      : 'نام تغییر‌دهنده در دسترس نیست';
  return `${new Date(record.updatedAt).toLocaleString('fa-IR')} · ${actor}`;
}
