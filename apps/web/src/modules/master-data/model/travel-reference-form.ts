import type { MasterDataRecord } from '@nora/contracts';
import { getMasterDataDefinition } from './catalog';

export type TravelReferenceResource = 'transfer-types' | 'visa-services';
export type TravelReferenceMutationValue =
  string | number | readonly string[] | null;
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function travelReferenceFormValues(
  resource: TravelReferenceResource,
  record?: MasterDataRecord,
): Record<string, string> {
  const values = Object.fromEntries(
    getMasterDataDefinition(resource).fields.map(({ key }) => [
      key,
      key === 'name'
        ? (record?.name ?? '')
        : String(record?.attributes[key] ?? ''),
    ]),
  );
  values.displayOrder ||= '0';
  if (resource === 'visa-services')
    values.referenceValidityMode = String(
      record?.attributes.referenceValidityMode ?? 'DAYS',
    );
  if (resource === 'visa-services')
    values.requiredDocumentNames = JSON.stringify(
      requiredDocumentNames(record?.attributes.requiredDocumentNames),
    );
  values.status = record?.status ?? 'active';
  return values;
}

export function requiredDocumentNames(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === 'string')
      ? parsed
      : [];
  } catch {
    return [];
  }
}

export function normalizeRequiredDocumentNames(values: readonly string[]) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }
  return result;
}

export function travelReferenceFieldLimit(key: string) {
  if (key === 'description') return 1000;
  if (key === 'vehicleType' || key === 'visaType') return 120;
  if (key === 'guidanceFileReference') return 36;
  return 160;
}

export function validateTravelReferenceForm(
  resource: TravelReferenceResource,
  input: Record<string, string>,
) {
  const values = Object.fromEntries(
    Object.keys(travelReferenceFormValues(resource)).map((key) => [
      key,
      (input[key] ?? '').trim(),
    ]),
  );
  const errors: Record<string, string> = {};
  for (const field of getMasterDataDefinition(resource).fields) {
    const value = values[field.key] ?? '';
    if (field.required && !value)
      errors[field.key] = `${field.label} الزامی است.`;
    if (
      field.type === 'text' &&
      field.key !== 'requiredDocumentNames' &&
      value.length > travelReferenceFieldLimit(field.key)
    )
      errors[field.key] = `${field.label} بیش از حد طولانی است.`;
    if (
      field.options &&
      value &&
      !field.options.some((option) => option.value === value)
    )
      errors[field.key] = `${field.label} معتبر نیست.`;
  }
  for (const [key, max] of [
    ['displayOrder', 2147483647],
    ['suggestedCapacity', 100],
    ['suggestedCapacityMin', 100],
    ['referenceValidityDays', 3650],
  ] as const) {
    if (!Object.hasOwn(values, key)) continue;
    if (!values[key] && key !== 'displayOrder') continue;
    const number = Number(values[key] || 0);
    if (
      !Number.isSafeInteger(number) ||
      number < (key === 'displayOrder' ? 0 : 1) ||
      number > max
    )
      errors[key] = 'عدد صحیح در بازه مجاز وارد کنید.';
    else values[key] = String(number);
  }
  if (
    resource === 'transfer-types' &&
    values.suggestedCapacityMin &&
    (!values.suggestedCapacity ||
      Number(values.suggestedCapacityMin) > Number(values.suggestedCapacity))
  )
    errors.suggestedCapacityMin =
      'حداقل ظرفیت نباید از حداکثر بیشتر باشد و به حداکثر نیاز دارد.';
  if (resource === 'visa-services') {
    const documents = requiredDocumentNames(values.requiredDocumentNames);
    if (
      documents.length > 50 ||
      documents.some((name) => !name.trim() || name.trim().length > 160)
    )
      errors.requiredDocumentNames =
        'حداکثر ۵۰ نام مدرک تا ۱۶۰ نویسه مجاز است.';
    if (
      !['DAYS', 'PASSPORT_EXPIRY'].includes(values.referenceValidityMode ?? '')
    )
      errors.referenceValidityMode = 'نوع اعتبار مرجع را انتخاب کنید.';
    if (
      values.referenceValidityMode === 'PASSPORT_EXPIRY' &&
      values.referenceValidityDays
    )
      errors.referenceValidityDays =
        'برای این نوع اعتبار، تعداد روز ثابت ثبت نمی‌شود.';
    for (const key of ['countryId', 'supplierId', 'guidanceFileReference'])
      if (values[key] && !uuid.test(values[key]))
        errors[key] = 'شناسه مرجع معتبر نیست.';
  }
  if (!['active', 'inactive'].includes(values.status ?? ''))
    errors.status = 'وضعیت را انتخاب کنید.';
  return { values, errors, success: Object.keys(errors).length === 0 };
}

export function travelReferenceMutationValues(
  resource: TravelReferenceResource,
  input: Record<string, string>,
  record?: MasterDataRecord,
) {
  const result = validateTravelReferenceForm(resource, input);
  if (!result.success) throw new Error('فیلدهای خدمت را اصلاح کنید.');
  if (result.values.status === (record?.status ?? 'active'))
    delete result.values.status;
  if (resource === 'visa-services' && record)
    delete result.values.referenceValidityMode;
  const values: Record<string, TravelReferenceMutationValue> = {
    ...result.values,
  };
  if (resource === 'visa-services')
    values.requiredDocumentNames = requiredDocumentNames(
      result.values.requiredDocumentNames,
    );
  return values;
}

export function transferCapacityLabel(record: MasterDataRecord) {
  const minimum = record.attributes.suggestedCapacityMin;
  const maximum = record.attributes.suggestedCapacity;
  if (typeof maximum !== 'number') return 'مشخص نشده';
  const to = maximum.toLocaleString('fa-IR');
  return typeof minimum !== 'number'
    ? `تا ${to} نفر`
    : minimum === maximum
      ? `${to} نفر`
      : `${minimum.toLocaleString('fa-IR')} تا ${to} نفر`;
}

export function visaValidityLabel(record: MasterDataRecord) {
  if (record.attributes.referenceValidityMode === 'PASSPORT_EXPIRY')
    return 'تا پایان اعتبار پاسپورت';
  const days = record.attributes.referenceValidityDays;
  return typeof days === 'number'
    ? `${days.toLocaleString('fa-IR')} روز`
    : 'مشخص نشده';
}

export function transferUsageLabel(record?: MasterDataRecord) {
  const count = record?.attributes.usageCount;
  return record?.attributes.usageStatus === 'AVAILABLE' &&
    typeof count === 'number' &&
    Number.isSafeInteger(count) &&
    count >= 0
    ? `${count.toLocaleString('fa-IR')} سرویس`
    : 'در انتظار اتصال رزرو';
}
