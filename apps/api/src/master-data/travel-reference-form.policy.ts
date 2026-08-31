import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';

type Resource = 'transfer-types' | 'visa-services';
type Values = Record<string, string | number | readonly string[] | null>;

export function prepareTravelReferenceForm(
  resource: Resource,
  input: Values,
  actor: AuthenticatedActor,
  creating: boolean,
) {
  const values = { ...input };
  const statusData: Record<string, unknown> = {};
  const textFields = [
    ['name', 160],
    ['englishName', 160],
    ['description', 1000],
    [resource === 'transfer-types' ? 'vehicleType' : 'visaType', 120],
  ] as const;
  for (const [field, limit] of textFields) {
    if (!Object.hasOwn(values, field)) continue;
    const value = values[field];
    if (value !== null && typeof value !== 'string')
      throw new BadRequestException('عنوان و شرح خدمت باید متن باشند.');
    const trimmed = (value ?? '').trim();
    const required =
      field === 'name' || field === 'vehicleType' || field === 'visaType';
    if (trimmed.length > limit || (required && !trimmed))
      throw new BadRequestException(`مقدار ${field} معتبر نیست.`);
    values[field] = trimmed || null;
  }
  for (const [field, maximum] of [
    ['displayOrder', 2147483647],
    ['suggestedCapacity', 100],
    ['suggestedCapacityMin', 100],
    ['referenceValidityDays', 3650],
  ] as const) {
    if (!Object.hasOwn(values, field)) continue;
    const raw = values[field];
    if (raw !== null && typeof raw !== 'number' && typeof raw !== 'string')
      throw new BadRequestException(`مقدار ${field} باید عدد صحیح باشد.`);
    if (raw === null || String(raw).trim() === '') {
      values[field] = field === 'displayOrder' ? 0 : null;
      continue;
    }
    const number = Number(raw);
    if (
      !Number.isSafeInteger(number) ||
      number < (field === 'displayOrder' ? 0 : 1) ||
      number > maximum
    )
      throw new BadRequestException(`مقدار ${field} خارج از بازه مجاز است.`);
    values[field] = number;
  }
  if (
    Object.hasOwn(values, 'serviceMode') &&
    typeof values.serviceMode !== 'string'
  )
    throw new BadRequestException('شیوه سرویس ترانسفر معتبر نیست.');
  if (
    Object.hasOwn(values, 'referenceValidityMode') &&
    (typeof values.referenceValidityMode !== 'string' ||
      !['DAYS', 'PASSPORT_EXPIRY'].includes(values.referenceValidityMode))
  )
    throw new BadRequestException('نوع اعتبار مرجع ویزا معتبر نیست.');
  if (Object.hasOwn(values, 'status')) {
    const status = values.status;
    if (status !== 'active' && status !== 'inactive')
      throw new BadRequestException('وضعیت خدمت معتبر نیست.');
    if (
      !(creating && status === 'active') &&
      !actor.permissions.includes('master_data.status.manage')
    )
      throw new ForbiddenException('مجوز تغییر وضعیت خدمت وجود ندارد.');
    delete values.status;
    statusData.isActive = status === 'active';
    statusData.deactivatedAt = status === 'inactive' ? new Date() : null;
    statusData.deactivatedByUserId =
      status === 'inactive' ? actor.userId : null;
  }
  return { values, statusData };
}

export function completeTravelReferenceDetails(
  resource: Resource,
  data: Record<string, unknown>,
  existing: Record<string, unknown> | null,
): Record<string, unknown> {
  const value = (field: string) =>
    Object.hasOwn(data, field) ? data[field] : existing?.[field];
  if (resource === 'transfer-types') {
    const minimum = value('suggestedCapacityMin');
    const maximum = value('suggestedCapacity');
    if (
      minimum != null &&
      (maximum == null || Number(minimum) > Number(maximum))
    )
      throw new BadRequestException(
        'حداقل ظرفیت باید با حداکثر ظرفیت و کوچک‌تر یا مساوی آن باشد.',
      );
    return {};
  }
  const mode = value('referenceValidityMode') ?? 'DAYS';
  if (mode === 'PASSPORT_EXPIRY') {
    if (
      Object.hasOwn(data, 'referenceValidityDays') &&
      data.referenceValidityDays != null
    )
      throw new BadRequestException(
        'اعتبار تا پایان پاسپورت نمی‌تواند تعداد روز ثابت داشته باشد.',
      );
    return { referenceValidityDays: null };
  }
  return {};
}
