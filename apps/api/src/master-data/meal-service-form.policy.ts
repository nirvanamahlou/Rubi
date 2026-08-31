import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';

type Values = Record<string, string | number | readonly string[] | null>;

export function rethrowMealServiceWriteError(error: unknown): never {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
    throw new ConflictException({
      code: 'MASTER_DATA_DUPLICATE_CODE',
      message: 'کد سرویس قبلاً ثبت شده است.',
    });
  throw error;
}

export function prepareMealServiceForm(
  input: Values,
  actor: AuthenticatedActor,
  creating: boolean,
) {
  const values = { ...input };
  const statusData: Record<string, unknown> = {};
  for (const key of ['name', 'englishName'] as const) {
    if (!Object.hasOwn(values, key)) continue;
    const raw = values[key];
    if (raw !== null && typeof raw !== 'string')
      throw new BadRequestException('عنوان وعده/سرویس باید متن باشد.');
    const value = (raw ?? '').trim();
    if (value.length > 160 || (key === 'name' && !value))
      throw new BadRequestException(
        'عنوان فارسی الزامی و عنوان‌ها حداکثر ۱۶۰ نویسه هستند.',
      );
    values[key] = value || null;
  }
  if (Object.hasOwn(values, 'code')) {
    if (
      typeof values.code !== 'string' ||
      !/^[A-Z0-9][A-Z0-9_-]{1,31}$/.test(values.code.trim().toUpperCase())
    )
      throw new BadRequestException(
        'کد سرویس باید ۲ تا ۳۲ حرف لاتین، عدد، خط تیره یا زیرخط باشد.',
      );
    values.code = values.code.trim().toUpperCase();
  }
  if (Object.hasOwn(values, 'category') && typeof values.category !== 'string')
    throw new BadRequestException('دسته وعده/سرویس معتبر نیست.');
  if (Object.hasOwn(values, 'includedMeals')) {
    let raw: unknown = values.includedMeals;
    if (typeof raw === 'string') {
      if (raw.trim().startsWith('[')) {
        try {
          raw = JSON.parse(raw);
        } catch {
          throw new BadRequestException('فهرست وعده‌ها معتبر نیست.');
        }
      } else
        raw = raw
          .split(/[,،]/)
          .map((item) => item.trim())
          .filter(Boolean);
    }
    if (raw === null) raw = [];
    if (
      !Array.isArray(raw) ||
      raw.length > 20 ||
      raw.some(
        (item) =>
          typeof item !== 'string' || !item.trim() || item.trim().length > 80,
      )
    )
      throw new BadRequestException(
        'حداکثر ۲۰ وعده متنی با طول ۸۰ نویسه مجاز است.',
      );
    values.includedMeals = [
      ...new Set((raw as string[]).map((item) => item.trim())),
    ];
  }
  if (Object.hasOwn(values, 'status')) {
    const status = values.status;
    if (
      typeof status !== 'string' ||
      !['active', 'inactive', 'under_review'].includes(status)
    )
      throw new BadRequestException('وضعیت وعده/سرویس معتبر نیست.');
    if (
      !(creating && status === 'active') &&
      !actor.permissions.includes('master_data.status.manage')
    )
      throw new ForbiddenException('مجوز تغییر وضعیت وعده/سرویس وجود ندارد.');
    delete values.status;
    Object.assign(statusData, {
      isActive: status === 'active',
      isUnderReview: status === 'under_review',
      deactivatedAt: status === 'active' ? null : new Date(),
      deactivatedByUserId: status === 'active' ? null : actor.userId,
    });
  }
  return { values, statusData };
}
