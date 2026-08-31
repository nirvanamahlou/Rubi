import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';

type Values = Record<string, string | number | readonly string[] | null>;
const hoursKeys = ['operatingHoursMode', 'opensAt', 'closesAt'] as const;

/** Status is an authorized mutation, not a client-owned database flag. */
export function prepareTerminalForm(
  input: Values,
  actor: AuthenticatedActor,
  creating: boolean,
  existing: Record<string, unknown> = {},
) {
  const values = { ...input };
  const statusData: Record<string, unknown> = {};
  if (
    Object.hasOwn(values, 'terminalType') &&
    typeof values.terminalType !== 'string'
  )
    throw new BadRequestException('نوع ترمینال معتبر نیست.');
  if (
    Object.hasOwn(values, 'airportId') &&
    typeof values.airportId !== 'string'
  )
    throw new BadRequestException('فرودگاه معتبر نیست.');
  for (const key of ['name', 'englishName'] as const) {
    if (!Object.hasOwn(values, key)) continue;
    const raw = values[key];
    if (raw !== null && typeof raw !== 'string')
      throw new BadRequestException('عنوان ترمینال باید متن باشد.');
    const value = (raw ?? '').trim();
    if (value.length > 160 || (key === 'name' && !value))
      throw new BadRequestException(
        'عنوان ترمینال الزامی و حداکثر ۱۶۰ نویسه است.',
      );
    values[key] = value || null;
  }
  if (Object.hasOwn(values, 'gateCount')) {
    const raw = values.gateCount;
    if (raw === null || raw === '') values.gateCount = null;
    else {
      if (
        (typeof raw !== 'string' && typeof raw !== 'number') ||
        (typeof raw === 'string' && !/^\d+$/.test(raw.trim()))
      )
        throw new BadRequestException('تعداد گیت باید عدد صحیح نامنفی باشد.');
      const count = Number(raw);
      if (!Number.isSafeInteger(count) || count < 0 || count > 2147483647)
        throw new BadRequestException('تعداد گیت باید عدد صحیح نامنفی باشد.');
      values.gateCount = count;
    }
  }
  if (hoursKeys.some((key) => Object.hasOwn(values, key))) {
    const hours = Object.fromEntries(
      hoursKeys.map((key) => {
        const raw = Object.hasOwn(values, key) ? values[key] : existing[key];
        if (raw != null && typeof raw !== 'string')
          throw new BadRequestException('ساعت فعالیت معتبر نیست.');
        return [key, typeof raw === 'string' ? raw.trim() || null : null];
      }),
    );
    const { operatingHoursMode: mode, opensAt: start, closesAt: end } = hours;
    const valid =
      mode === null
        ? start === null && end === null
        : mode === 'ALL_DAY'
          ? start === null && end === null
          : mode === 'TIME_RANGE' &&
            typeof start === 'string' &&
            typeof end === 'string' &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(start) &&
            /^(([01]\d|2[0-3]):[0-5]\d|24:00)$/.test(end) &&
            start !== end;
    if (!valid)
      throw new BadRequestException(
        'ساعت فعالیت را به‌صورت ۲۴ ساعته یا بازه معتبر وارد کنید.',
      );
    Object.assign(values, hours);
  }
  if (Object.hasOwn(values, 'status')) {
    const status = values.status;
    if (
      !['active', 'inactive', 'maintenance'].includes(String(status)) ||
      typeof status !== 'string'
    )
      throw new BadRequestException('وضعیت ترمینال معتبر نیست.');
    if (
      !(creating && status === 'active') &&
      !actor.permissions.includes('master_data.status.manage')
    )
      throw new ForbiddenException('مجوز تغییر وضعیت ترمینال وجود ندارد.');
    delete values.status;
    Object.assign(statusData, {
      isActive: status === 'active',
      isUnderMaintenance: status === 'maintenance',
      deactivatedAt: status === 'active' ? null : new Date(),
      deactivatedByUserId: status === 'active' ? null : actor.userId,
    });
  }
  return { values, statusData };
}
