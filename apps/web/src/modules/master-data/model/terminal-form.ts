import type { MasterDataRecord } from '@rubi/contracts';

export const terminalTypes = [
  { value: 'DOMESTIC', label: 'داخلی' },
  { value: 'INTERNATIONAL', label: 'بین‌المللی' },
  { value: 'MIXED', label: 'مشترک' },
  { value: 'VIP', label: 'VIP' },
] as const;
export const terminalStatuses = [
  { value: 'active', label: 'فعال' },
  { value: 'inactive', label: 'غیرفعال' },
  { value: 'maintenance', label: 'تعمیرات' },
] as const;
export const terminalHoursModes = [
  { value: 'ALL_DAY', label: '۲۴ ساعته' },
  { value: 'TIME_RANGE', label: 'بازه ساعت' },
] as const;

export function terminalFormStatus(record?: MasterDataRecord) {
  return record?.attributes.isUnderMaintenance === true
    ? 'maintenance'
    : (record?.status ?? 'active');
}
export function terminalStatusLabel(record: MasterDataRecord) {
  return (
    terminalStatuses.find((item) => item.value === terminalFormStatus(record))
      ?.label ?? 'غیرفعال'
  );
}
export function terminalFormValues(
  record?: MasterDataRecord,
): Record<string, string> {
  return {
    name: record?.name ?? '',
    englishName: String(record?.attributes.englishName ?? ''),
    airportId: String(record?.attributes.airportId ?? ''),
    terminalType: String(record?.attributes.terminalType ?? ''),
    gateCount: String(record?.attributes.gateCount ?? ''),
    displayOrder: String(record?.attributes.displayOrder ?? '0'),
    operatingHoursMode: String(record?.attributes.operatingHoursMode ?? ''),
    opensAt: String(record?.attributes.opensAt ?? ''),
    closesAt: String(record?.attributes.closesAt ?? ''),
    status: terminalFormStatus(record),
  };
}
function asciiDigits(value: string) {
  return value.replace(/[۰-۹٠-٩]/g, (digit) =>
    String(digit.charCodeAt(0) - (digit >= '۰' ? 1776 : 1632)),
  );
}
export function validateTerminalForm(input: Record<string, string>) {
  const values = Object.fromEntries(
    Object.keys(terminalFormValues()).map((key) => [
      key,
      (input[key] ?? '').trim(),
    ]),
  );
  const errors: Record<string, string> = {};
  if (!values.name || values.name.length > 160)
    errors.name = 'عنوان فارسی الزامی و حداکثر ۱۶۰ نویسه است.';
  if ((values.englishName ?? '').length > 160)
    errors.englishName = 'عنوان انگلیسی حداکثر ۱۶۰ نویسه است.';
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      values.airportId ?? '',
    )
  )
    errors.airportId = 'فرودگاه را انتخاب کنید.';
  if (!terminalTypes.some((item) => item.value === values.terminalType))
    errors.terminalType = 'نوع ترمینال را انتخاب کنید.';
  if (!terminalStatuses.some((item) => item.value === values.status))
    errors.status = 'وضعیت را انتخاب کنید.';
  values.gateCount = asciiDigits(values.gateCount ?? '');
  values.displayOrder = asciiDigits(values.displayOrder ?? '0');
  if (
    values.gateCount &&
    (!/^\d+$/.test(values.gateCount) || Number(values.gateCount) > 2147483647)
  )
    errors.gateCount = 'تعداد گیت باید عدد صحیح نامنفی باشد.';
  if (
    !/^\d+$/.test(values.displayOrder) ||
    Number(values.displayOrder) > 100000
  )
    errors.displayOrder = 'ترتیب نمایش باید عدد صحیح بین صفر تا ۱۰۰٬۰۰۰ باشد.';
  values.opensAt = asciiDigits(values.opensAt ?? '');
  values.closesAt = asciiDigits(values.closesAt ?? '');
  if (values.operatingHoursMode === 'TIME_RANGE') {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(values.opensAt))
      errors.opensAt = 'شروع فعالیت را با قالب 05:00 وارد کنید.';
    if (!/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(values.closesAt))
      errors.closesAt = 'پایان فعالیت را با قالب 22:00 یا 24:00 وارد کنید.';
    if (values.opensAt === values.closesAt)
      errors.closesAt =
        'شروع و پایان برابر نباشند؛ برای کل روز «۲۴ ساعته» را انتخاب کنید.';
  } else if (
    values.operatingHoursMode &&
    values.operatingHoursMode !== 'ALL_DAY'
  )
    errors.operatingHoursMode = 'ساعت فعالیت معتبر نیست.';
  else if (values.opensAt || values.closesAt)
    errors.operatingHoursMode =
      'برای ساعت شروع و پایان، بازه ساعت را انتخاب کنید.';
  return { values, errors, success: !Object.keys(errors).length };
}
export function terminalMutationValues(
  values: Record<string, string>,
  record?: MasterDataRecord,
) {
  const result = validateTerminalForm(values);
  if (!result.success) throw new Error('فیلدهای ترمینال را اصلاح کنید.');
  if (result.values.status === terminalFormStatus(record))
    delete result.values.status;
  return result.values;
}
export function terminalHoursLabel(record: MasterDataRecord) {
  if (record.attributes.operatingHoursMode === 'ALL_DAY') return '۲۴ ساعته';
  if (
    record.attributes.operatingHoursMode === 'TIME_RANGE' &&
    record.attributes.opensAt &&
    record.attributes.closesAt
  )
    return `${record.attributes.opensAt} تا ${record.attributes.closesAt}`;
  return 'تعیین نشده';
}
export function terminalUpdatedLabel(
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
