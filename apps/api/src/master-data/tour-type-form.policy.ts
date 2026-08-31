import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuthenticatedActor } from '@rubi/contracts';

type Values = Record<string, string | number | readonly string[] | null>;

/** Server-owned metadata and status are never accepted as ordinary text fields. */
export function prepareTourTypeForm(
  input: Values,
  actor: AuthenticatedActor,
  creating: boolean,
) {
  const values = { ...input };
  const statusData: Record<string, unknown> = {};
  for (const [field, limit] of [
    ['name', 160],
    ['englishName', 160],
    ['description', 1000],
  ] as const) {
    if (!Object.hasOwn(values, field)) continue;
    const value = values[field];
    if (value !== null && typeof value !== 'string')
      throw new BadRequestException('عنوان و شرح نوع تور باید متن باشند.');
    const trimmed = (value ?? '').trim();
    if (trimmed.length > limit || (field === 'name' && !trimmed))
      throw new BadRequestException(`مقدار ${field} نوع تور معتبر نیست.`);
    values[field] = trimmed || null;
  }
  if (Object.hasOwn(values, 'scope') && typeof values.scope !== 'string')
    throw new BadRequestException('دامنه نوع تور معتبر نیست.');
  if (Object.hasOwn(values, 'displayOrder')) {
    const raw = values.displayOrder;
    if (raw !== null && typeof raw !== 'number' && typeof raw !== 'string')
      throw new BadRequestException('ترتیب نمایش معتبر نیست.');
    const order = Number(raw || 0);
    if (!Number.isSafeInteger(order) || order < 0 || order > 2147483647)
      throw new BadRequestException('ترتیب نمایش باید عدد صحیح نامنفی باشد.');
    values.displayOrder = order;
  }
  if (Object.hasOwn(values, 'status')) {
    const status = values.status;
    if (status !== 'active' && status !== 'inactive')
      throw new BadRequestException('وضعیت نوع تور معتبر نیست.');
    if (
      !(creating && status === 'active') &&
      !actor.permissions.includes('master_data.status.manage')
    )
      throw new ForbiddenException('مجوز تغییر وضعیت نوع تور وجود ندارد.');
    delete values.status;
    statusData.isActive = status === 'active';
    statusData.deactivatedAt = status === 'inactive' ? new Date() : null;
    statusData.deactivatedByUserId =
      status === 'inactive' ? actor.userId : null;
  }
  return { values, statusData };
}
